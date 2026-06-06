---
author: Aniket Maurya
authorUrl: "https://www.linkedin.com/in/aniketmaurya"
pubDatetime: 2026-06-06
modDatetime: 2026-06-06
title: "How qcow2 Overlays Work in QEMU"
description: "Learn how qcow2 backing files work in QEMU, why they are different from Linux overlayfs, and how they make VM sandbox cloning fast and cheap."
featured: true
draft: false
tags:
  - qemu
  - qcow2
  - virtualization
  - sandboxes
  - smolvm
---

We are using `qcow2` disk images for our sandbox VMs.

A common question is whether `qcow2` uses Linux `overlayfs`.

The answer is:

**No. qcow2 does not use overlayfs.**

`qcow2` has its own copy-on-write mechanism built into QEMU at the block-device layer.

---

## 1. overlayfs vs qcow2

`overlayfs` is a Linux filesystem feature.

It is commonly used by containers. It layers one filesystem on top of another filesystem.

For example:

```text
lowerdir/   # base filesystem
upperdir/   # writable changes
merged/     # final combined view
```

This works at the file and directory level.

`qcow2` is different.

`qcow2` works at the virtual disk block level. That means QEMU tracks changes in chunks of the VM's disk image, not individual files and folders inside the guest OS.

The guest operating system does not know it is using an overlay. It just sees a normal disk.

This means `qcow2` overlays work for:

- Linux guests
- Windows guests
- other operating systems

That is why `qcow2` is a good fit for VM-based sandboxes.

---

## 2. The basic idea

With QEMU, we can create a base image and then create a writable overlay on top of it.

```text
base.qcow2
   ↑
sandbox-123.qcow2
```

The base image contains the operating system and preinstalled software.

The overlay image stores only the changes made by one sandbox instance.

The base image remains unchanged.

---

## 3. Read path

When the VM reads from disk, QEMU checks the overlay first.

```text
if block exists in overlay:
    read from overlay
else:
    read from base image
```

So if the sandbox has modified a block, QEMU reads the modified version from the overlay.

If the sandbox has not modified that block, QEMU reads it from the base image.

---

## 4. Write path

When the VM writes to disk, QEMU writes into the overlay image.

```text
write goes to sandbox-123.qcow2
base.qcow2 stays unchanged
```

The base image is not modified.

This is what makes cheap sandbox cloning possible.

Each sandbox can get its own writable disk image without copying the full base image.

---

## 5. Creating a base image

A base image is usually a prepared VM disk.

For example:

```bash
qemu-img create -f qcow2 base.qcow2 40G
```

Then you install the OS, packages, agents, drivers, and tools into this image.

After the base image is ready, treat it as a golden image.

Ideally, make it read-only from the host side:

```bash
chmod 444 base.qcow2
```

This helps prevent accidental writes to the base image.

---

## 6. Creating a sandbox overlay

For each sandbox, create a new `qcow2` overlay backed by the base image.

```bash
qemu-img create \
  -f qcow2 \
  -F qcow2 \
  -b base.qcow2 \
  sandbox-123.qcow2
```

Meaning:

```text
-f qcow2      # create the new image as qcow2
-F qcow2      # backing file format is qcow2
-b base.qcow2 # use base.qcow2 as the backing image
```

The overlay starts very small.

It grows only as the VM writes new data.

---

## 7. Booting the sandbox

Now boot the VM using the overlay, not the base image.

```bash
qemu-system-x86_64 \
  -m 4096 \
  -smp 4 \
  -drive file=sandbox-123.qcow2,format=qcow2,if=virtio \
  -enable-kvm
```

The guest OS sees a normal disk.

Internally, QEMU reads unchanged blocks from `base.qcow2` and writes changed blocks to `sandbox-123.qcow2`.

---

## 8. Resetting a sandbox

To reset a sandbox back to the original state, delete the overlay and create a new one.

```bash
rm sandbox-123.qcow2

qemu-img create \
  -f qcow2 \
  -F qcow2 \
  -b base.qcow2 \
  sandbox-123.qcow2
```

This gives a clean machine again without rebuilding or copying the full base image.

This is the common pattern for local development sandboxes.

---

## 9. Inspecting the backing chain

You can inspect the image and its backing file using:

```bash
qemu-img info sandbox-123.qcow2
```

You should see something like:

```text
image: sandbox-123.qcow2
file format: qcow2
backing file: base.qcow2
backing file format: qcow2
```

To see the full backing chain:

```bash
qemu-img info --backing-chain sandbox-123.qcow2
```

This is useful for debugging.

---

## 10. Why this is useful for sandboxes

This design gives us:

- fast sandbox creation
- cheap per-sandbox disk state
- easy reset
- immutable base images
- support for Windows and Linux guests
- no dependency on guest filesystem internals
- no need for Linux `overlayfs`

This is especially important for VM-based sandboxes because the guest may be Windows.

`overlayfs` is a Linux filesystem feature. It is not the right abstraction for Windows guest disks.

`qcow2` works below the guest filesystem, so it does not care what filesystem the guest uses.

---

## 11. Mental model

The clean mental model is:

```text
overlayfs = file-level copy-on-write for Linux filesystems

qcow2 backing files = block-level copy-on-write for VM disks
```

Or even shorter:

```text
overlayfs is for containers.
qcow2 overlays are for VMs.
```

That is not perfectly precise, but it is the right practical intuition.

---

## 12. Common gotchas

### 1. Do not boot directly from the base image

The base image should be treated as immutable.

Booting directly from it can mutate the golden state.

Use a per-sandbox overlay instead.

---

### 2. Be careful with relative backing paths

When you create an overlay like this:

```bash
qemu-img create -f qcow2 -F qcow2 -b base.qcow2 sandbox.qcow2
```

the backing file path may be stored as a relative path.

If you move files around, QEMU may not find the base image.

For production-like systems, prefer a clear image layout or absolute paths.

Example:

```bash
qemu-img create \
  -f qcow2 \
  -F qcow2 \
  -b /var/lib/sandbox/images/base.qcow2 \
  /var/lib/sandbox/instances/sandbox-123.qcow2
```

---

### 3. The overlay depends on the base image

The overlay does not contain the full disk.

It contains only changed blocks.

So this will not work by itself:

```text
sandbox-123.qcow2
```

unless the backing image is also present.

If you need a standalone image, you need to flatten or convert it.

Example:

```bash
qemu-img convert \
  -O qcow2 \
  sandbox-123.qcow2 \
  standalone.qcow2
```

---

### 4. Overlay size grows over time

The overlay starts small but grows as the guest writes data.

For short-lived sandboxes, this is fine.

For long-running machines, you may need cleanup, compaction, or image rotation.

---

## 13. Recommended sandbox flow

For our sandbox use case, the recommended flow is:

```text
1. Build a golden base image.
2. Make the base image read-only.
3. For every new sandbox, create a qcow2 overlay.
4. Boot QEMU using the overlay.
5. Store all sandbox writes in the overlay.
6. To reset, delete the overlay.
7. To persist or export, flatten the overlay into a standalone image.
```

Example:

```bash
BASE=/var/lib/sandbox/images/base.qcow2
INSTANCE=/var/lib/sandbox/instances/sandbox-123.qcow2

qemu-img create \
  -f qcow2 \
  -F qcow2 \
  -b "$BASE" \
  "$INSTANCE"

qemu-system-x86_64 \
  -m 4096 \
  -smp 4 \
  -drive file="$INSTANCE",format=qcow2,if=virtio \
  -enable-kvm
```

---

## Summary

`qcow2` does not use `overlayfs`.

It uses QEMU’s own block-level copy-on-write system.

This allows us to keep a clean base VM image and create cheap writable sandbox overlays on top of it.

For sandbox infrastructure, this is the right abstraction because it works across guest operating systems, including Windows.
