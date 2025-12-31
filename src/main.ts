import "./style.css";

// --- Interfaces ---
interface HistoryItem {
  id: number;
  svg: string;
  code: string;
  date: string;
}

// --- Constants ---
const DEFAULT_SVG_HREF =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%231f2937'/%3E%3Ctext x='50' y='50' font-size='50' fill='%23ffffff' text-anchor='middle' dy='.3em' font-family='Poppins, sans-serif' font-weight='bold'%3ERJ%3C/text%3E%3C/svg%3E";
const STORAGE_KEY = "favicon_history_v1";

// --- DOM Elements ---
const els = {
  svgInput: document.getElementById("svgInput") as HTMLTextAreaElement,
  urlInput: document.getElementById("urlInput") as HTMLInputElement,
  outputCode: document.getElementById("outputCode") as HTMLTextAreaElement,
  previewImg: document.getElementById("previewImg") as HTMLImageElement,
  historyList: document.getElementById("historyList") as HTMLDivElement,

  // Buttons
  btnPaste: document.getElementById("btnPaste") as HTMLButtonElement,
  btnGenerate: document.getElementById("btnGenerate") as HTMLButtonElement,
  btnCopy: document.getElementById("btnCopy") as HTMLButtonElement,
  btnFetch: document.getElementById("btnFetch") as HTMLButtonElement,
  btnExport: document.getElementById("btnExport") as HTMLButtonElement,
  btnClear: document.getElementById("btnClear") as HTMLButtonElement,

  // Tabs
  tabCode: document.getElementById("tab-code") as HTMLButtonElement,
  tabUrl: document.getElementById("tab-url") as HTMLButtonElement,
  groupCode: document.getElementById("input-group-code") as HTMLDivElement,
  groupUrl: document.getElementById("input-group-url") as HTMLDivElement,
};

// --- Initialization ---
const init = () => {
  // Set default if empty
  if (!els.svgInput.value) {
    els.svgInput.value = decodeURIComponent(
      DEFAULT_SVG_HREF.replace("data:image/svg+xml,", ""),
    );
  }

  processInput();
  renderHistory();
  setupListeners();
};

// --- Logic ---
const processInput = () => {
  let raw = els.svgInput.value.trim();

  if (!raw) {
    els.outputCode.value = "";
    els.previewImg.src = "";
    return;
  }

  // Handle pasted <link> tags
  if (raw.startsWith("<link")) {
    const match = raw.match(/href="([^"]*)"/);
    if (match) raw = match[1];
  }

  // Handle existing data URIs
  if (raw.startsWith("data:image/svg+xml,")) {
    raw = decodeURIComponent(raw.replace("data:image/svg+xml,", ""));
    // Update input to show raw SVG if they pasted a data URI
    els.svgInput.value = raw;
  }

  // Minimize (basic)
  const cleanSvg = raw.replace(/\r?\n|\r/g, "").replace(/\s+/g, " ");

  // Encode
  const encoded = encodeURIComponent(cleanSvg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");

  const dataUri = `data:image/svg+xml,${encoded}`;
  const tag = `<link rel="icon" type="image/svg+xml" href="${dataUri}" />`;

  els.outputCode.value = tag;
  els.previewImg.src = dataUri;

  // Update browser favicon dynamically
  let pageLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!pageLink) {
    pageLink = document.createElement("link");
    pageLink.rel = "icon";
    document.head.appendChild(pageLink);
  }
  pageLink.href = dataUri;
};

const fetchUrl = async () => {
  const url = els.urlInput.value.trim();
  if (!url) return;

  els.btnFetch.innerText = "Fetching...";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    // Check if it looks like SVG
    if (!text.includes("<svg")) throw new Error("Not a valid SVG file");

    els.svgInput.value = text;
    processInput();
    switchTab("code"); // Switch back to code view to show result
    alert("SVG fetched successfully!");
  } catch (err) {
    console.error(err);
    alert(
      "Failed to fetch SVG. CORS might be blocking this request. Try downloading the file and pasting the code.",
    );
  } finally {
    els.btnFetch.innerText = "Fetch";
  }
};

const saveHistory = () => {
  const currentSvg = els.svgInput.value.trim();
  const currentOutput = els.outputCode.value.trim();
  if (!currentSvg) return;

  const entry: HistoryItem = {
    id: Date.now(),
    svg: currentSvg,
    code: currentOutput,
    date: new Date().toLocaleString(),
  };

  const history = getHistory();
  history.unshift(entry);
  if (history.length > 50) history.pop(); // Max 50 items

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderHistory();
};

const getHistory = (): HistoryItem[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const renderHistory = () => {
  const history = getHistory();
  els.historyList.innerHTML = "";

  if (history.length === 0) {
    els.historyList.innerHTML =
      '<div class="text-zinc-600 text-center text-sm py-4">No history yet.</div>';
    return;
  }

  history.forEach((item) => {
    const div = document.createElement("div");
    div.className =
      "bg-zinc-950 border border-zinc-800 p-3 rounded-lg flex justify-between items-center group hover:border-zinc-700 transition-colors";

    const snippet = item.svg.substring(0, 40).replace(/</g, "&lt;") + "...";

    div.innerHTML = `
      <div class="overflow-hidden">
        <div class="text-xs text-blue-500 mb-0.5">${item.date}</div>
        <div class="text-xs text-zinc-400 font-mono truncate" title="Click to load">${snippet}</div>
      </div>
      <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button class="load-btn px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-white" data-id="${item.id}">Load</button>
      </div>
    `;

    // Attach event listener specifically for the load button
    const loadBtn = div.querySelector(".load-btn") as HTMLButtonElement;
    loadBtn.onclick = () => {
      els.svgInput.value = item.svg;
      processInput();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    els.historyList.appendChild(div);
  });
};

const switchTab = (tab: "code" | "url") => {
  if (tab === "code") {
    els.tabCode.classList.replace("text-zinc-400", "text-blue-400");
    els.tabCode.classList.replace("border-transparent", "border-blue-500"); // Add active border
    els.tabCode.classList.add("border-b-2");

    els.tabUrl.classList.replace("text-blue-400", "text-zinc-400");
    els.tabUrl.classList.remove("border-b-2", "border-blue-500");

    els.groupCode.classList.remove("hidden");
    els.groupUrl.classList.add("hidden");
  } else {
    els.tabUrl.classList.replace("text-zinc-400", "text-blue-400");
    els.tabUrl.classList.add("border-b-2", "border-blue-500");

    els.tabCode.classList.replace("text-blue-400", "text-zinc-400");
    els.tabCode.classList.remove("border-b-2", "border-blue-500");

    els.groupUrl.classList.remove("hidden");
    els.groupCode.classList.add("hidden");
  }
};

// --- Event Listeners ---
const setupListeners = () => {
  els.svgInput.addEventListener("input", processInput);

  els.btnPaste.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      els.svgInput.value = text;
      processInput();
    } catch {
      alert("Clipboard permission denied");
    }
  });

  els.btnGenerate.addEventListener("click", () => {
    processInput();
    saveHistory();
  });

  els.btnCopy.addEventListener("click", () => {
    if (!els.outputCode.value) return;
    els.outputCode.select();
    document.execCommand("copy");
    const originalText = els.btnCopy.innerText;
    els.btnCopy.innerText = "Copied!";
    setTimeout(() => (els.btnCopy.innerText = originalText), 2000);
  });

  els.btnFetch.addEventListener("click", fetchUrl);

  els.tabCode.addEventListener("click", () => switchTab("code"));
  els.tabUrl.addEventListener("click", () => switchTab("url"));

  els.btnClear.addEventListener("click", () => {
    if (confirm("Clear history?")) {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
    }
  });

  els.btnExport.addEventListener("click", () => {
    const data = localStorage.getItem(STORAGE_KEY) || "[]";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `favicon-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
};

// Start
init();
