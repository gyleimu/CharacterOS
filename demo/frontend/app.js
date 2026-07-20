(() => {
  const input = document.querySelector("#event-input");
  const processButton = document.querySelector("#process-button");
  const resetButton = document.querySelector("#reset-button");
  const result = document.querySelector("#result");
  const pipelineStatus = document.querySelector("#pipeline-status");
  const connectionStatus = document.querySelector("#connection-status");
  const memoryCount = document.querySelector("#memory-count");
  const memoryDelta = document.querySelector("#memory-delta");
  const experienceCount = document.querySelector("#experience-count");
  const help = document.querySelector("#event-help");
  const historyList = document.querySelector("#history-list");
  const eventKind = document.querySelector("#event-kind");
  const memoryTitle = document.querySelector("#memory-title");
  const memorySummary = document.querySelector("#memory-summary");
  const impactLevel = document.querySelector("#impact-level");
  const impactScore = document.querySelector("#impact-score");
  const impactCluster = document.querySelector("#impact-cluster");
  const impactBoundary = document.querySelector("#impact-boundary");
  const impactCopy = document.querySelector("#impact-copy");
  const behaviorBefore = document.querySelector("#behavior-before");
  const behaviorAfter = document.querySelector("#behavior-after");
  const exampleButtons = [...document.querySelectorAll(".example-button")];
  const steps = [...document.querySelectorAll(".pipeline-steps li")];
  let running = false;
  let ready = false;

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function formatCoordinate(value) {
    return (value * 100).toFixed(2);
  }

  function formatDelta(before, after) {
    const delta = (after - before) * 100;
    if (Math.abs(delta) < 0.0005) return "unchanged in this core step";
    return `${delta > 0 ? "+" : ""}${delta.toFixed(3)} percentage points in this core step`;
  }

  function impactPresentation(score) {
    if (score >= 0.65) {
      return {
        level: "High",
        description: "This experience creates a strong but bounded personality adjustment that can accumulate over time.",
      };
    }
    if (score >= 0.35) {
      return {
        level: "Medium",
        description: "This experience creates a noticeable but gradual personality adjustment.",
      };
    }
    return {
      level: "Low",
      description: "Small personality adjustment. More experiences may accumulate over time.",
    };
  }

  function trendPresentation(metric, before, after) {
    const delta = after - before;
    const meanings = {
      trust: {
        increase: "Alex becomes slightly more open to trusting others.",
        decrease: "Alex becomes slightly more cautious when trusting others.",
      },
      fear: {
        increase: "Alex becomes slightly more alert to possible threats.",
        decrease: "Alex feels slightly less on guard in uncertain situations.",
      },
      control: {
        increase: "Alex becomes slightly more likely to seek predictability and control.",
        decrease: "Alex becomes slightly more comfortable with uncertainty.",
      },
    };
    if (Math.abs(delta) < 0.000005) {
      return {
        trend: "→ Stable",
        meaning: "This event created no measurable movement in this coordinate during the current core step.",
      };
    }
    const direction = delta > 0 ? "increase" : "decrease";
    return {
      trend: `${delta > 0 ? "↑" : "↓"} Slight ${direction}`,
      meaning: meanings[metric][direction],
    };
  }

  function beforeBehaviorSummary() {
    return "Before this experience, Alex responds according to the personality tendencies already present in his current state.";
  }

  function afterBehaviorSummary(beforeCoordinate, afterCoordinate, decisionBefore, decisionAfter) {
    const shifts = ["trust", "fear", "control"].map((metric) => ({
      metric,
      delta: afterCoordinate[metric] - beforeCoordinate[metric],
    }));
    const dominantShift = shifts.reduce((largest, current) => (
      Math.abs(current.delta) > Math.abs(largest.delta) ? current : largest
    ));
    const shiftMeaning = trendPresentation(
      dominantShift.metric,
      beforeCoordinate[dominantShift.metric],
      afterCoordinate[dominantShift.metric],
    ).meaning;
    if (Math.abs(dominantShift.delta) < 0.000005) {
      return "Behavior tendency remains broadly stable after this experience. More experiences may gradually create a clearer shift.";
    }
    const decisionChanged = decisionBefore.mostLikelyAction !== decisionAfter.mostLikelyAction;
    return `${shiftMeaning} Behavior tendency slightly adjusted, not completely rewritten.${decisionChanged ? " The derived response direction also changed." : ""}`;
  }

  function setConnection(message, mode) {
    connectionStatus.textContent = message;
    connectionStatus.className = `boundary-badge ${mode}`;
  }

  function setPipeline(message, mode = "") {
    pipelineStatus.textContent = message;
    pipelineStatus.className = `pipeline-status ${mode}`.trim();
  }

  function setText(id, value) {
    document.querySelector(`#${id}`).textContent = String(value);
  }

  function renderHistory(memories) {
    historyList.replaceChildren();
    const initialState = document.createElement("li");
    initialState.className = "baseline";
    initialState.innerHTML = "<span aria-hidden=\"true\">00</span><b>Initial state</b><small>Experience timeline begins before any MemoryNode exists</small>";
    historyList.append(initialState);
    memories.forEach((memory, index) => {
      const item = document.createElement("li");
      if (index === memories.length - 1) item.className = "new";
      const marker = String(index + 1).padStart(2, "0");
      item.innerHTML = "";
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = marker;
      const title = document.createElement("b");
      title.textContent = memory.content;
      const details = document.createElement("small");
      details.textContent = `Experience ${index + 1} · ${memory.category} · ${memory.emotion}`;
      item.append(icon, title, details);
      historyList.append(item);
    });
  }

  function renderState(state) {
    const coordinate = state.coordinate;
    setText("initial-trust", formatCoordinate(coordinate.trust));
    setText("initial-fear", formatCoordinate(coordinate.fear));
    setText("initial-control", formatCoordinate(coordinate.control));
    memoryCount.textContent = String(state.memoryCount);
    experienceCount.textContent = String(state.memoryCount);
    memoryDelta.textContent = "";
    renderHistory(state.memories);
    behaviorBefore.textContent = beforeBehaviorSummary();
  }

  function renderEvolution(payload) {
    const { before, after, parsed, memory, impact, decisionBefore, decisionAfter } = payload;
    eventKind.textContent = `${parsed.category} · ${parsed.parser.source}`;
    memoryTitle.textContent = `${parsed.category} memory`;
    memorySummary.textContent = `${memory.content} — ${memory.beliefEffect}`;
    const presentation = impactPresentation(impact.score);
    impactLevel.textContent = presentation.level;
    impactScore.textContent = impact.score.toFixed(3);
    impactCluster.textContent = impact.clusterMass.toFixed(3);
    impactBoundary.textContent = impact.boundaryPhase;
    impactCopy.textContent = presentation.description;
    for (const metric of ["trust", "fear", "control"]) {
      const beforeValue = before.coordinate[metric];
      const afterValue = after.coordinate[metric];
      setText(`${metric}-before`, formatCoordinate(beforeValue));
      setText(`${metric}-after`, formatCoordinate(afterValue));
      setText(`${metric}-impact`, `${metric[0].toUpperCase()}${metric.slice(1)}: ${formatDelta(beforeValue, afterValue)}.`);
      const trend = trendPresentation(metric, beforeValue, afterValue);
      setText(`${metric}-trend`, `Trend: ${trend.trend}`);
      setText(`${metric}-meaning`, `Meaning: ${trend.meaning}`);
      const bar = document.querySelector(`.${metric} .bar span`);
      bar.style.setProperty("--before", `${formatCoordinate(beforeValue)}%`);
      bar.style.setProperty("--after", `${formatCoordinate(afterValue)}%`);
    }
    memoryCount.textContent = String(after.memoryCount);
    experienceCount.textContent = String(after.memoryCount);
    memoryDelta.textContent = "+1";
    renderHistory(after.memories);
    behaviorBefore.textContent = beforeBehaviorSummary();
    behaviorAfter.textContent = afterBehaviorSummary(before.coordinate, after.coordinate, decisionBefore, decisionAfter);
  }

  function markReadyForNewExperience() {
    if (!ready || running) return;
    processButton.disabled = false;
    processButton.innerHTML = "<span>Process Event</span><i aria-hidden=\"true\">→</i>";
    setPipeline("Ready for core processing");
  }

  async function request(path, options = {}) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `Local core request failed (${response.status})`);
    return payload;
  }

  async function loadState() {
    try {
      const payload = await request("/api/state");
      renderState(payload);
      ready = true;
      processButton.disabled = false;
      help.textContent = "Connected to the local CharacterOS core. Choose an example or write an experience.";
      setConnection("LOCAL CORE · IN-MEMORY SESSION", "connected");
      setPipeline("Ready for core processing");
    } catch (error) {
      ready = false;
      processButton.disabled = true;
      help.textContent = `Core unavailable: ${error.message}. Run \"npx tsx demo/server.ts\".`;
      setConnection("LOCAL CORE UNAVAILABLE", "error");
      setPipeline("Core unavailable", "error");
    }
  }

  async function processEvent() {
    const description = input.value.trim();
    if (running || !ready) return;
    if (!description) {
      help.textContent = "Enter an experience before processing.";
      input.focus();
      return;
    }
    running = true;
    processButton.disabled = true;
    processButton.innerHTML = "<span>Calling Core...</span><i aria-hidden=\"true\">◌</i>";
    setPipeline("Core processing", "running");
    try {
      const payload = await request("/api/evolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      for (const step of steps) {
        step.classList.add("active");
        await wait(260);
        step.classList.remove("active");
        step.classList.add("complete");
      }
      renderEvolution(payload);
      result.classList.add("visible", "processed");
      setPipeline("Core result received", "done");
      help.textContent = `Parsed as ${payload.parsed.category}; the result above came from the current in-memory core state.`;
      processButton.innerHTML = "<span>Process Another Event</span><i aria-hidden=\"true\">→</i>";
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      setPipeline("Core request failed", "error");
      help.textContent = error.message;
      processButton.innerHTML = "<span>Retry Core Request</span><i aria-hidden=\"true\">↻</i>";
    } finally {
      running = false;
      processButton.disabled = !ready;
    }
  }

  async function reset() {
    if (running) return;
    try {
      await request("/api/reset", { method: "POST" });
      result.classList.remove("visible", "processed");
      steps.forEach((step) => step.classList.remove("active", "complete"));
      memoryTitle.textContent = "Memory pending";
      memorySummary.textContent = "Process an event to create a real MemoryNode in the local core session.";
      impactLevel.textContent = "Awaiting result";
      impactScore.textContent = "—";
      impactCluster.textContent = "—";
      impactBoundary.textContent = "—";
      impactCopy.textContent = "Impact level is calculated from the core-generated impact magnitude.";
      behaviorAfter.textContent = "Process an event to receive the updated derived decision.";
      await loadState();
    } catch (error) {
      help.textContent = error.message;
    }
  }

  processButton.addEventListener("click", processEvent);
  resetButton.addEventListener("click", reset);
  exampleButtons.forEach((button) => button.addEventListener("click", () => {
    input.value = button.dataset.example;
    help.textContent = "Example loaded. You can still edit it before sending it to the core.";
    markReadyForNewExperience();
    input.focus();
  }));
  input.addEventListener("input", markReadyForNewExperience);
  loadState();
})();
