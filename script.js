const display = document.getElementById("display");
const expressionEl = document.getElementById("expression");
const answerLine = document.getElementById("answerLine");
const angleModeBtn = document.getElementById("angleMode");
const angleIndicator = document.getElementById("angleIndicator");
const memoryIndicator = document.getElementById("memoryIndicator");
const historyList = document.getElementById("historyList");
const historyPanel = document.getElementById("historyPanel");

let expression = "";
let answer = 0;
let lastAnswer = 0;
let memory = 0;
let angleMode = "DEG";
let history = JSON.parse(localStorage.getItem("novacalc-history") || "[]");
let justCalculated = false;

const operators = ["+", "−", "×", "÷", "^"];

function isOperator(ch) { return operators.includes(ch); }

function render() {
  display.value = expression || "0";
  expressionEl.textContent = expression || "\u00a0";
  memoryIndicator.style.opacity = memory !== 0 ? "1" : ".45";
  angleIndicator.textContent = angleMode;
  angleModeBtn.textContent = angleMode;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) throw new Error("Math error");
  if (Math.abs(n) < 1e-12) n = 0;
  return Number(n.toPrecision(12)).toString();
}

function append(value) {
  if (justCalculated && (/[0-9.πe]/.test(value) || value.includes("("))) {
    expression = "";
    answerLine.textContent = "";
  }
  justCalculated = false;

  if (value === "π" || value === "e" || value.includes("(")) {
    // Add multiplication when a constant/function follows a number or closing bracket.
    if (expression && /[\dπe)]$/.test(expression)) expression += "×";
    expression += value;
    render();
    return;
  }

  if (isOperator(value)) {
    if (!expression) {
      if (value === "−") expression = "−";
      return render();
    }
    if (isOperator(expression.at(-1))) expression = expression.slice(0, -1) + value;
    else expression += value;
    return render();
  }

  if (value === ".") {
    const current = expression.split(/[+−×÷^()]/).pop();
    if (current.includes(".")) return;
    if (!current || isOperator(expression.at(-1))) expression += "0";
  }

  expression += value;
  render();
}

function addPower(power) {
  if (!expression) return;
  if (/[0-9πe)]$/.test(expression)) {
    expression += power;
    render();
  }
}

function factorial(n) {
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n || n > 170) throw new Error("Invalid factorial");
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function toRadians(x) { return angleMode === "DEG" ? x * Math.PI / 180 : x; }
function fromRadians(x) { return angleMode === "DEG" ? x * 180 / Math.PI : x; }

function evaluateExpression(input) {
  let s = input;
  // User-facing symbols -> JavaScript math functions.
  s = s.replaceAll("π", "PI").replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
  s = s.replaceAll("^", "**");

  // Convert postfix factorial, including simple parenthesized values.
  let previous = "";
  while (previous !== s) {
    previous = s;
    s = s.replace(/(\d+(?:\.\d+)?|PI|E|\([^()]*\))!/g, "fact($1)");
  }

  // Replace constants/functions.
  s = s.replace(/\be\b/g, "E");
  s = s.replace(/\bsin\(/g, "sin(").replace(/\bcos\(/g, "cos(").replace(/\btan\(/g, "tan(");
  s = s.replace(/\basin\(/g, "asin(").replace(/\bacos\(/g, "acos(").replace(/\batan\(/g, "atan(");
  s = s.replace(/\blog\(/g, "log10(").replace(/\bln\(/g, "ln(");
  s = s.replace(/\bsqrt\(/g, "sqrt(").replace(/\babs\(/g, "abs(").replace(/\bexp\(/g, "exp(");

  // Only permit known calculator syntax.
  if (!/^[0-9+\-*/().,\sA-Za-z_]+$/.test(s)) throw new Error("Invalid input");
  const allowedNames = ["PI","E","sin","cos","tan","asin","acos","atan","log10","ln","sqrt","abs","exp","fact"];
  const identifiers = s.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  if (identifiers.some(x => !allowedNames.includes(x))) throw new Error("Invalid function");

  const sin = x => Math.sin(toRadians(x));
  const cos = x => Math.cos(toRadians(x));
  const tan = x => {
    const r = toRadians(x);
    if (Math.abs(Math.cos(r)) < 1e-12) throw new Error("Undefined");
    return Math.tan(r);
  };
  const asin = x => fromRadians(Math.asin(x));
  const acos = x => fromRadians(Math.acos(x));
  const atan = x => fromRadians(Math.atan(x));
  const log10 = x => Math.log10(x);
  const ln = x => Math.log(x);
  const sqrt = x => Math.sqrt(x);
  const abs = x => Math.abs(x);
  const exp = x => Math.exp(x);
  const fact = x => factorial(x);
  const PI = Math.PI;
  const E = Math.E;

  const result = Function("sin","cos","tan","asin","acos","atan","log10","ln","sqrt","abs","exp","fact","PI","E",
    '"use strict"; return (' + s + ')')(sin,cos,tan,asin,acos,atan,log10,ln,sqrt,abs,exp,fact,PI,E);

  if (!Number.isFinite(result)) throw new Error("Math error");
  return result;
}

function calculate() {
  if (!expression || isOperator(expression.at(-1))) return;
  try {
    const result = evaluateExpression(expression);
    const formatted = formatNumber(result);
    answer = result;
    lastAnswer = result;
    answerLine.textContent = "= " + formatted;
    addHistory(expression, formatted);
    expression = formatted;
    justCalculated = true;
    render();
  } catch (err) {
    answerLine.textContent = err.message || "Invalid expression";
    display.value = "Error";
    setTimeout(render, 900);
  }
}

function clearAll() {
  expression = "";
  answer = 0;
  answerLine.textContent = "";
  justCalculated = false;
  render();
}

function removeLast() {
  if (justCalculated) return clearAll();
  expression = expression.slice(0, -1);
  render();
}

function percent() {
  if (!expression) return;
  try {
    const result = evaluateExpression(expression) / 100;
    expression = formatNumber(result);
    render();
  } catch {
    answerLine.textContent = "Invalid percentage";
  }
}

function currentValue() {
  if (!expression) return answer || 0;
  try { return evaluateExpression(expression); } catch { return 0; }
}

function memoryAction(action) {
  const value = currentValue();
  if (action === "memory-clear") memory = 0;
  if (action === "memory-recall") { expression = formatNumber(memory); justCalculated = false; }
  if (action === "memory-plus") memory += value;
  if (action === "memory-minus") memory -= value;
  render();
}

function useAns() {
  if (expression && /[\dπe)]$/.test(expression)) expression += "×";
  expression += formatNumber(lastAnswer);
  justCalculated = false;
  render();
}

function addHistory(exp, result) {
  history.unshift({ exp, result, time: Date.now() });
  history = history.slice(0, 30);
  localStorage.setItem("novacalc-history", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<div class="empty-history"><span>◷</span><p>No calculations yet</p><small>Your recent calculations will appear here.</small></div>';
    return;
  }
  historyList.innerHTML = history.map((item, i) =>
    `<div class="history-item" data-index="${i}">
      <div class="history-expression">${escapeHTML(item.exp)}</div>
      <div class="history-result">= ${escapeHTML(item.result)}</div>
    </div>`
  ).join("");
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

document.querySelectorAll("[data-value]").forEach(btn => {
  btn.addEventListener("click", () => {
    const value = btn.dataset.value;
    if (value === "^2") return addPower("^2");
    if (value === "^3") return addPower("^3");
    if (value === "1/") {
      if (!expression) return;
      expression = "1/(" + expression + ")";
      return render();
    }
    if (value === "!") {
      if (expression && /[\dπe)]$/.test(expression)) expression += "!";
      return render();
    }
    append(value);
  });
});

document.querySelectorAll("[data-action]").forEach(btn => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "clear") clearAll();
    else if (action === "delete") removeLast();
    else if (action === "equals") calculate();
    else if (action === "percent") percent();
    else if (action.startsWith("memory-")) memoryAction(action);
    else if (action === "ans") useAns();
  });
});

angleModeBtn.addEventListener("click", () => {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  render();
});

document.getElementById("historyToggle").addEventListener("click", () => {
  historyPanel.classList.toggle("show");
  if (historyPanel.classList.contains("show")) historyPanel.scrollIntoView({ behavior:"smooth", block:"start" });
});

document.getElementById("clearHistory").addEventListener("click", () => {
  history = [];
  localStorage.removeItem("novacalc-history");
  renderHistory();
});

document.getElementById("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("novacalc-theme", document.body.classList.contains("light") ? "light" : "dark");
});

historyList.addEventListener("click", e => {
  const item = e.target.closest(".history-item");
  if (!item) return;
  const record = history[Number(item.dataset.index)];
  expression = record.exp;
  justCalculated = false;
  answerLine.textContent = "= " + record.result;
  render();
});

document.addEventListener("keydown", e => {
  if (/^[0-9.]$/.test(e.key)) append(e.key);
  else if (e.key === "+") append("+");
  else if (e.key === "-") append("−");
  else if (e.key === "*") append("×");
  else if (e.key === "/") append("÷");
  else if (e.key === "^") append("^");
  else if (e.key === "(" || e.key === ")") append(e.key);
  else if (e.key === "%") percent();
  else if (e.key === "!") { if (expression) expression += "!"; render(); }
  else if (e.key === "Enter" || e.key === "=") calculate();
  else if (e.key === "Backspace") removeLast();
  else if (e.key === "Escape") clearAll();
});

if (localStorage.getItem("novacalc-theme") === "light") document.body.classList.add("light");
render();
renderHistory();
