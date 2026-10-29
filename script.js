
const essay = document.getElementById("essay");
const counts = document.getElementById("counts");
const results = document.getElementById("results");
const errorBox = document.getElementById("error");

let latestReport = null;

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map(s => s.trim())
    .filter(Boolean);
}

function words(text) {
  return text.toLowerCase().match(/\b[\p{L}\p{N}'’-]+\b/gu) || [];
}

function mean(arr) {
  return arr.length
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : 0;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function updateCounts() {
  const wordCount = words(essay.value).length;
  const sentenceCount = splitSentences(essay.value).length;
  counts.textContent = `${wordCount} words · ${sentenceCount} sentences`;
}

essay.addEventListener("input", updateCounts);

document.getElementById("clearBtn").addEventListener("click", () => {
  essay.value = "";
  updateCounts();
  results.hidden = true;
  errorBox.hidden = true;
  latestReport = null;
});

document.getElementById("demoBtn").addEventListener("click", () => {
  essay.value =
    "Clear communication helps people understand complex ideas. " +
    "For example, a useful report defines its terms before presenting evidence. " +
    "In addition, the writer should explain how each conclusion follows from the observations. " +
    "These choices make the document easier to review. " +
    "Clear communication also benefits readers who have different levels of background knowledge.";

  updateCounts();
});

function analyze(text) {
  const sentences = splitSentences(text);
  const tokens = words(text);
  const lengths = sentences.map(s => words(s).length);

  if (tokens.length < 20) {
    throw new Error("Please enter at least 20 words for analysis.");
  }

  const unique = new Set(tokens);
  const ttr = unique.size / tokens.length;
  const cv = mean(lengths)
    ? stddev(lengths) / mean(lengths)
    : 0;

  const transitions = [
    "in addition", "moreover", "furthermore",
    "however", "therefore", "for example",
    "consequently", "in conclusion",
    "on the other hand"
  ];

  const lower = text.toLowerCase();

  const transitionHits = transitions.reduce((total, phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = lower.match(
      new RegExp("\\b" + escaped + "\\b", "g")
    );
    return total + (matches ? matches.length : 0);
  }, 0);

  let repeatedPairs = 0;

  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) {
      repeatedPairs++;
    }
  }

  const metrics = [
    {
      name: "Sentence-length variation",
      value: Math.min(100, cv * 160),
      detail: `Average sentence length: ${round(mean(lengths))} words. Uniform sentence lengths can occur in both human and AI writing.`
    },
    {
      name: "Vocabulary variety",
      value: (1 - ttr) * 100,
      detail: `${unique.size} unique words among ${tokens.length} words. Topic and sample length affect this measure.`
    },
    {
      name: "Transition phrase reuse",
      value: Math.min(
        100,
        transitionHits / Math.max(1, sentences.length) * 180
      ),
      detail: `Found ${transitionHits} common transition phrase occurrences. This does not establish authorship.`
    },
    {
      name: "Repeated adjacent words",
      value: Math.min(
        100,
        repeatedPairs / Math.max(1, tokens.length - 1) * 1000
      ),
      detail: "Checks immediate repetitions of adjacent words."
    }
  ];

  const score = Math.round(
    metrics.reduce((sum, metric) => sum + metric.value, 0) /
    metrics.length
  );

  const observations = sentences.slice(0, 12).map(sentence => {
    const length = words(sentence).length;

    let reason = "No simple length flag. This does not establish authorship.";

    if (length > 30) {
      reason = "Long sentence: consider whether it contains several ideas.";
    } else if (length < 6) {
      reason = "Short sentence: inspect its role and context.";
    }

    return { text: sentence, reason };
  });

  return {
    score,
    metrics,
    observations,
    wordCount: tokens.length,
    sentenceCount: sentences.length
  };
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

document.getElementById("analyzeBtn").addEventListener("click", () => {
  errorBox.hidden = true;

  try {
    const report = analyze(essay.value);
    latestReport = report;

    document.getElementById("score").textContent = report.score;
    document.getElementById("scoreText").textContent =
      "Heuristic pattern indicator — not an AI probability";

    document.getElementById("signalCount").textContent =
      report.metrics.length;

    document.getElementById("signals").innerHTML =
      report.metrics.map(metric => `
        <div class="signal">
          <div class="signal-top">
            <span>${escapeHTML(metric.name)}</span>
            <span>${Math.round(metric.value)} / 100</span>
          </div>
          <div class="meter">
            <span style="width:${Math.min(100, metric.value)}%"></span>
          </div>
          <p>${escapeHTML(metric.detail)}</p>
        </div>
      `).join("");

    document.getElementById("sentences").innerHTML =
      report.observations.map((item, index) => `
        <div class="sentence">
          <p><strong>${index + 1}.</strong> ${escapeHTML(item.text)}</p>
          <small>${escapeHTML(item.reason)}</small>
        </div>
      `).join("");

    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  if (!latestReport) return;

  const lines = [
    "AuthentiWrite AI — Heuristic Signal Report",
    "This is not proof of authorship or a calibrated AI detector.",
    "",
    `Words: ${latestReport.wordCount}`,
    `Sentences: ${latestReport.sentenceCount}`,
    `Pattern indicator: ${latestReport.score}/100`,
    "",
    ...latestReport.metrics.map(metric =>
      `${metric.name}: ${round(metric.value)}/100\n${metric.detail}`
    ),
    "",
    "Sentence observations:",
    ...latestReport.observations.map((item, index) =>
      `${index + 1}. ${item.text}\n${item.reason}`
    )
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "authentiwrite-report.txt";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

updateCounts();
