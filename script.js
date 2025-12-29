// --- 1. LEXER ---
const TokenType = {
  KEYWORD: "KEYWORD",
  ID: "ID",
  NUM: "NUM",
  OP: "OP",
  PUNC: "PUNC",
  EOF: "EOF",
};

const TokenInfo = {
  [TokenType.KEYWORD]: {
    nombre: "Palabra reservada",
    patron: "Reservada",
  },
  [TokenType.ID]: { nombre: "Identificador", patron: "Identificador" },
  [TokenType.NUM]: { nombre: "Número", patron: "Num" },
  [TokenType.OP]: { nombre: "Operador", patron: "Operador" },
  [TokenType.PUNC]: { nombre: "Signo puntuacion", patron: "Signo" },
  [TokenType.EOF]: { nombre: "Fin de archivo", patron: "EOF" },
};

class Lexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
  }

  tokenize() {
    let tokens = [];
    while (this.pos < this.input.length) {
      let char = this.input[this.pos];

      // Comentarios
      if (char === "/") {
        const next = this.input[this.pos + 1];
        if (next === "/") {
          this.pos += 2;
          while (this.pos < this.input.length && this.input[this.pos] !== "\n")
            this.pos++;
          continue;
        }
        if (next === "*") {
          this.pos += 2;
          while (this.pos < this.input.length) {
            if (
              this.input[this.pos] === "*" &&
              this.input[this.pos + 1] === "/"
            ) {
              this.pos += 2;
              break;
            }
            if (this.input[this.pos] === "\n") this.line++;
            this.pos++;
          }
          continue;
        }
      }

      if (/\s/.test(char)) {
        if (char === "\n") this.line++;
        this.pos++;
        continue;
      }

      // Números Decimales
      if (/[0-9]/.test(char)) {
        let num = "";
        while (
          this.pos < this.input.length &&
          /[0-9]/.test(this.input[this.pos])
        ) {
          num += this.input[this.pos++];
        }
        if (this.pos < this.input.length && this.input[this.pos] === ".") {
          num += this.input[this.pos++];
          while (
            this.pos < this.input.length &&
            /[0-9]/.test(this.input[this.pos])
          ) {
            num += this.input[this.pos++];
          }
        }
        tokens.push({ type: TokenType.NUM, value: num, line: this.line });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        let id = "";
        while (
          this.pos < this.input.length &&
          /[a-zA-Z0-9_]/.test(this.input[this.pos])
        )
          id += this.input[this.pos++];
        // AQUI AGREGAMOS "try" y "catch"
        const isKw = ["let", "if", "else", "function", "try", "catch"].includes(
          id
        );
        tokens.push({
          type: isKw ? TokenType.KEYWORD : TokenType.ID,
          value: id,
          line: this.line,
        });
        continue;
      }

      const twoChar = this.input.substr(this.pos, 2);
      if (["==", ">=", "<=", "!="].includes(twoChar)) {
        tokens.push({
          type: TokenType.OP,
          value: twoChar,
          line: this.line,
        });
        this.pos += 2;
        continue;
      }

      if (/[+\-*/=><]/.test(char)) {
        tokens.push({ type: TokenType.OP, value: char, line: this.line });
        this.pos++;
        continue;
      }

      if (/[(){};]/.test(char)) {
        tokens.push({
          type: TokenType.PUNC,
          value: char,
          line: this.line,
        });
        this.pos++;
        continue;
      }

      this.pos++;
    }
    tokens.push({ type: TokenType.EOF, value: "EOF", line: this.line });
    return tokens;
  }
}

// --- 2. PARSER ---
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
    this.errors = [];
  }
  peek() {
    return this.tokens[this.current];
  }

  consume(type, val) {
    const t = this.peek();
    if (t.type === type && (!val || t.value === val)) {
      this.current++;
      return t;
    }
    throw new Error(
      `Error de Sintaxis (Línea ${t.line}): Se esperaba '${
        val || type
      }' pero se encontró '${t.value}'`
    );
  }

  parse() {
    const body = [];
    while (this.peek().type !== TokenType.EOF) {
      try {
        body.push(this.parseStatement());
      } catch (e) {
        this.errors.push(e.message);
        body.push({ type: "ERROR_NODE", message: e.message });
        this.synchronize();
      }
    }
    return { type: "Program", body };
  }

  synchronize() {
    while (this.peek().type !== TokenType.EOF && this.peek().value !== ";")
      this.current++;
    if (this.peek().value === ";") this.current++;
  }

  parseStatement() {
    const t = this.peek();

    // LÓGICA DE TRY-CATCH (INTEGRADA)
    if (t.type === TokenType.KEYWORD && t.value === "try") {
      this.consume(TokenType.KEYWORD);
      this.consume(TokenType.PUNC, "{");
      const tryBlock = [];
      while (this.peek().value !== "}" && this.peek().type !== TokenType.EOF) {
        tryBlock.push(this.parseStatement());
      }
      this.consume(TokenType.PUNC, "}");

      this.consume(TokenType.KEYWORD, "catch");
      this.consume(TokenType.PUNC, "(");
      const errorVar = this.consume(TokenType.ID).value;
      this.consume(TokenType.PUNC, ")");
      this.consume(TokenType.PUNC, "{");
      const catchBlock = [];
      while (this.peek().value !== "}" && this.peek().type !== TokenType.EOF) {
        catchBlock.push(this.parseStatement());
      }
      this.consume(TokenType.PUNC, "}");
      return { type: "TryCatch", tryBlock, errorVar, catchBlock };
    }

    if (t.type === TokenType.KEYWORD && t.value === "let") {
      this.consume(TokenType.KEYWORD);
      const id = this.consume(TokenType.ID).value;
      this.consume(TokenType.OP, "=");
      const init = this.parseExpression();
      this.consume(TokenType.PUNC, ";");
      return { type: "VarDecl", id, init };
    }

    if (t.type === TokenType.KEYWORD && t.value === "if") {
      this.consume(TokenType.KEYWORD);
      this.consume(TokenType.PUNC, "(");
      const test = this.parseExpression();
      this.consume(TokenType.PUNC, ")");
      this.consume(TokenType.PUNC, "{");
      const cons = [];
      while (this.peek().value !== "}" && this.peek().type !== TokenType.EOF)
        cons.push(this.parseStatement());
      this.consume(TokenType.PUNC, "}");
      return { type: "If", test, body: cons };
    }

    if (t.type === TokenType.ID) {
      const id = this.consume(TokenType.ID).value;
      this.consume(TokenType.OP, "=");
      const right = this.parseExpression();
      this.consume(TokenType.PUNC, ";");
      return { type: "Assign", left: id, right };
    }

    throw new Error(
      `Instrucción no reconocida en línea ${t.line}: '${t.value}'`
    );
  }

  parseExpression() {
    let left = this.parseAddition();
    while ([">", "<", ">=", "<=", "==", "!="].includes(this.peek().value)) {
      const operator = this.consume(TokenType.OP).value;
      const right = this.parseAddition();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  parseAddition() {
    let left = this.parseTerm();
    while (this.peek().value === "+" || this.peek().value === "-") {
      const operator = this.consume(TokenType.OP).value;
      const right = this.parseTerm();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  parseTerm() {
    let left = this.parseF();
    while (this.peek().value === "*" || this.peek().value === "/") {
      const operator = this.consume(TokenType.OP).value;
      const right = this.parseF();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  parseF() {
    const t = this.peek();
    if (t.type === TokenType.NUM) {
      this.consume(TokenType.NUM);
      return { type: "Literal", value: t.value };
    }
    if (t.type === TokenType.ID) {
      this.consume(TokenType.ID);
      return { type: "ID", name: t.value };
    }
    if (t.value === "(") {
      this.consume(TokenType.PUNC, "(");
      const expr = this.parseExpression();
      this.consume(TokenType.PUNC, ")");
      return expr;
    }
    throw new Error(`Se esperaba Expresión, se encontró '${t.value}'`);
  }
}

// --- 3. RENDERIZADO ---
function createNode(label, sub, type) {
  const div = document.createElement("div");
  div.className = "node-content";
  if (type === "ERROR_NODE") div.className += " error-node";
  div.innerHTML = label + (sub ? `<span class="node-sub">${sub}</span>` : "");
  return div;
}

function renderTree(node) {
  if (!node) return null;
  const li = document.createElement("li");
  let label = node.type,
    sub = "",
    children = [];

  switch (node.type) {
    case "Program":
      label = "Program";
      children = node.body;
      break;
    case "VarDecl":
      label = "Var";
      sub = node.id;
      children = [node.init];
      break;
    case "Assign":
      label = "=";
      sub = "assign";
      children = [{ type: "ID_REF", name: node.left }, node.right];
      break;
    case "Binary":
      label = node.operator;
      sub = "op";
      children = [node.left, node.right];
      break;
    case "Literal":
      label = node.value;
      sub = "num";
      break;
    case "ID":
      label = node.name;
      sub = "id";
      break;
    case "ID_REF":
      label = node.name;
      sub = "ref";
      break;
    case "If":
      label = "IF";
      children = [node.test, { type: "Block", body: node.body }];
      break;
    case "Block":
      label = "{ }";
      children = node.body;
      break;

    // NUEVA VISUALIZACIÓN PARA TRY-CATCH
    case "TryCatch":
      label = "Try/Catch";
      children = [
        { type: "Block", body: node.tryBlock, label: "TRY" }, // Reutilizamos Block
        { type: "CatchBlock", body: node.catchBlock, arg: node.errorVar },
      ];
      break;
    case "CatchBlock":
      label = "CATCH";
      sub = "(" + node.arg + ")";
      children = node.body;
      break;

    case "ERROR_NODE":
      label = "ERROR";
      sub = "Sintaxis";
      break;
  }

  li.appendChild(createNode(label, sub, node.type));
  if (children && children.length) {
    const ul = document.createElement("ul");
    children.forEach((c) => {
      const childLi = renderTree(c);
      if (childLi) ul.appendChild(childLi);
    });
    li.appendChild(ul);
  }
  return li;
}

// --- 4. APP ---
function compile() {
  const code = document.getElementById("code").value;
  const consoleEl = document.getElementById("console-content");
  const astEl = document.getElementById("ast-view");
  const tokensEl = document.getElementById("tokens-content");
  consoleEl.innerHTML = "";
  astEl.innerHTML = "";
  tokensEl.innerHTML = "";

  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();

    // Tabla visual
    let tableHtml = `<table class="token-table"><thead><tr><th>Token</th><th>Lexema</th><th>Patrón</th></tr></thead><tbody>`;
    const vistos = new Set();
    tokens.forEach((t) => {
      if (t.type !== "EOF" && !vistos.has(t.value)) {
        vistos.add(t.value);
        const info = TokenInfo[t.type] || { nombre: t.type, patron: "-" };
        tableHtml += `<tr><td class="col-token">${info.nombre}</td><td class="col-lexema">${t.value}</td><td class="col-patron">${info.patron}</td></tr>`;
      }
    });
    tokensEl.innerHTML = tableHtml + "</tbody></table>";

    const parser = new Parser(tokens);
    const ast = parser.parse();
    const root = document.createElement("ul");
    root.appendChild(renderTree(ast));
    astEl.appendChild(root);

    if (parser.errors.length > 0) {
      consoleEl.innerHTML += `<div class="log-entry log-error"><b>Se encontraron ${parser.errors.length} errores:</b></div>`;
      parser.errors.forEach(
        (err) =>
          (consoleEl.innerHTML += `<div class="log-entry log-error">❌ ${err}</div>`)
      );
      showTab("console");
    } else {
      consoleEl.innerHTML += `<div class="log-entry log-success">✅ Compilación exitosa. Código procesado.</div>`;
    }
  } catch (e) {
    consoleEl.innerHTML = `<div class="log-entry log-error">Error Crítico: ${e.message}</div>`;
  }
}

function showTab(id) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const tabs = document.querySelectorAll(".tab");
  if (id === "ast") tabs[0].classList.add("active");
  if (id === "console") tabs[1].classList.add("active");
  if (id === "tokens") tabs[2].classList.add("active");
}

setTimeout(compile, 500);
