(function initPostHog(documentRef, posthogStub) {
  if (posthogStub.__SV) return;

  window.posthog = posthogStub;
  posthogStub._i = [];
  posthogStub.init = (projectApiKey, config, name) => {
    const addStubMethod = (target, methodPath) => {
      const parts = methodPath.split(".");
      let methodName = methodPath;

      if (parts.length === 2) {
        target = target[parts[0]];
        methodName = parts[1];
      }

      target[methodName] = (...args) => {
        target.push([methodName].concat(args));
      };
    };

    const script = documentRef.createElement("script");
    script.type = "text/javascript";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.src = `${config.api_host.replace(
      ".i.posthog.com",
      "-assets.i.posthog.com"
    )}/static/array.js`;

    const firstScript = documentRef.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(script, firstScript);

    let instance = posthogStub;
    let instanceName = name;

    if (instanceName !== undefined) {
      instance = posthogStub[instanceName] = [];
    } else {
      instanceName = "posthog";
    }

    instance.people = instance.people || [];
    instance.toString = showStub => {
      let label = "posthog";

      if (instanceName !== "posthog") label += `.${instanceName}`;
      if (!showStub) label += " (stub)";

      return label;
    };
    instance.people.toString = () => `${instance.toString(1)}.people (stub)`;

    const methods =
      "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveys onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(
        " "
      );

    for (let index = 0; index < methods.length; index += 1) {
      addStubMethod(instance, methods[index]);
    }

    posthogStub._i.push([projectApiKey, config, instanceName]);
  };
  posthogStub.__SV = 1;
})(document, window.posthog || []);

window.posthog.init("phc_vjIHlkZ5iOYWdZx0LXiifLKGl53QehS8LjudWiuSRND", {
  api_host: "https://us.i.posthog.com",
  defaults: "2025-11-30",
  person_profiles: "identified_only",
  capture_pageview: false, // Captured manually below
  capture_pageleave: true,
});

window.posthog.capture("$pageview");
