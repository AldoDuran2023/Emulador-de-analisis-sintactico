// --- 1. LEXER ---
// diccionario de tokens
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

// máquina que procesa el texto. POO
class Lexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
  }

  // motor principal
  tokenize() {
    // lista de objetos token
    let tokens = []; // aqui se guardan los tokens (generados)
    // recorre el input con un while
    while (this.pos < this.input.length) {
      // caracter actual
      let char = this.input[this.pos];

      // Comentarios ignorados de linea y bloque -- // o /* */
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
            // Manejo de líneas dentro de comentarios de bloque
            if (this.input[this.pos] === "\n") this.line++;
            this.pos++;
          }
          continue;
        }
      }

      // Espacios en blanco \s equivale a espacios, tabs, saltos de linea
      if (/\s/.test(char)) {
        if (char === "\n") this.line++;
        // avanza al siguiente caracter
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

      // Identificadores y Palabras Reservadas
      if (/[a-zA-Z_]/.test(char)) {
        let id = "";
        while (
          this.pos < this.input.length &&
          /[a-zA-Z0-9_]/.test(this.input[this.pos])
        )
          id += this.input[this.pos++];
        if (id === "console" && this.input.substr(this.pos, 4) === ".log") {
          id = "console.log";
          this.pos += 4; // Avanzamos 4 caracteres (. l o g)
        }
        // AQUI AGREGAMOS "try", "catch" y el resto de palabras reservadas
        const isKw = [
          // Declaración de variables y funciones
          "let",
          "const",
          "var",
          "function",
          "return",

          // Control de flujo (Condicionales)
          "if",
          "else",
          "switch",
          "case",
          "default",

          // Bucles (Iteraciones)
          "while",
          "for",
          "do",
          "break",
          "continue",

          // Manejo de errores
          "try",
          "catch",
          "finally",
          "throw",

          // Objetos y Clases
          "class",
          "extends",
          "new",
          "this",
          "super",

          // Módulos y Asincronía
          "import",
          "export",
          "from",
          "async",
          "await",

          // Valores constantes y Operadores tipo palabra
          "true",
          "false",
          "null",
          "undefined",
          "typeof",
          "void",
          "delete",
          "in",
          "instanceof",

          // Comandos de sistema (específicos de tu compilador)
          "console.log",
        ].includes(id);
        tokens.push({
          type: isKw ? TokenType.KEYWORD : TokenType.ID,
          value: id,
          line: this.line,
        });
        continue;
      }

      // Operadores (incluyendo operadores de dos caracteres)
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

      // Operadores de un solo carácter
      if (/[+\-*/=><]/.test(char)) {
        tokens.push({ type: TokenType.OP, value: char, line: this.line });
        this.pos++;
        continue;
      }

      // Signos de puntuación
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
    // EOF
    tokens.push({ type: TokenType.EOF, value: "EOF", line: this.line });
    return tokens;
  }
}

// --- 2. PARSER Analizador Sintáctico ---
// Esta fase recibe los Tokens del Lexer y verifica si tienen sentido gramatical (el orden correcto). Utiliza una técnica llamada Descenso Recursivo.
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0; // índice del token actual
    this.errors = []; // lista de errores encontrados
  }
  // Mira el token actual sin consumirlo (para decidir qué hacer).
  peek() {
    return this.tokens[this.current]; // token actual
  }

  // Verifica que el token actual sea el esperado (ej. esperar un ; al final). Si es correcto, avanza; si no, lanza un error de sintaxis.
  consume(type, val) {
    const t = this.peek();
    // Verificación del tipo y valor del token
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

  // Inicia el proceso y devuelve el objeto raíz del programa (Program). Maneja errores atrapándolos y guardándolos en una lista (this.errors).
  parse() {
    const body = []; // lista de declaraciones en el programa sentencia por sentencia
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

  // Si hay un error, esta función "salta" tokens hasta encontrar un punto y coma ;. Esto evita que un solo error detenga todo el análisis.
  // PANICK MODE
  synchronize() {
    while (
      this.peek().type !== TokenType.EOF &&
      this.peek().value !== ";" &&
      this.peek().value !== "}"
    )
      this.current++;
    if (this.peek().value === ";" || this.peek().value === "}") this.current++;
  }

  // Es el cerebro de decisiones. Mira el primer token y decide qué estructura crear:
  // LAS REGLAS GRAMATICALES VAN AQUI
  parseStatement() {
    const t = this.peek();

    if (t.type === TokenType.PUNC && t.value === ";") {
      this.consume(TokenType.PUNC, ";");
      return { type: "EmptyStatement" };
    }

    // Si ve console.log (tratado como KEYWORD en tu lexer)
    if (t.type === TokenType.KEYWORD && t.value === "console.log") {
      this.consume(TokenType.KEYWORD);
      this.consume(TokenType.PUNC, "(");
      // Permitimos imprimir una expresión (ej: console.log(x) o console.log(5))
      const argument = this.parseExpression();
      this.consume(TokenType.PUNC, ")");
      this.consume(TokenType.PUNC, ";");
      return { type: "ConsoleLog", argument };
    }

    // si ve un try, crea una estructura try-catch
    if (t.type === TokenType.KEYWORD && t.value === "try") {
      this.consume(TokenType.KEYWORD);
      this.consume(TokenType.PUNC, "{");
      const tryBlock = [];
      while (this.peek().value !== "}" && this.peek().type !== TokenType.EOF) {
        // aqui parsea las instrucciones dentro del try
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
        // aqui parsea las instrucciones dentro del catch
        catchBlock.push(this.parseStatement());
      }
      this.consume(TokenType.PUNC, "}");
      this.consume(TokenType.PUNC, ";");
      return { type: "TryCatch", tryBlock, errorVar, catchBlock };
    }

    // Si ve un let o un const declara una variable, int, string
    if (
      (t.type === TokenType.KEYWORD && t.value === "let") ||
      (t.type === TokenType.KEYWORD && t.value === "const")
    ) {
      this.consume(TokenType.KEYWORD);
      const id = this.consume(TokenType.ID).value;
      this.consume(TokenType.OP, "=");
      // Parsea la expresión de inicialización
      const init = this.parseExpression();
      this.consume(TokenType.PUNC, ";");
      return { type: "VarDecl", id, init };
    }

    // Si ve un return, crea un nodo de retorno
    if (t.type === TokenType.KEYWORD && t.value === "return") {
      this.consume(TokenType.KEYWORD);
      // Parsea la expresión que se va a retornar (ej: a / b)
      const argument = this.parseExpression();
      this.consume(TokenType.PUNC, ";");
      return { type: "Return", argument };
    }

    // Si ve un if, crea una estructura condicional
    if (t.type === TokenType.KEYWORD && t.value === "if") {
      this.consume(TokenType.KEYWORD);
      this.consume(TokenType.PUNC, "(");
      // Parsea la expresión de prueba
      const test = this.parseExpression();
      this.consume(TokenType.PUNC, ")");
      this.consume(TokenType.PUNC, "{");
      const cons = [];
      while (this.peek().value !== "}" && this.peek().type !== TokenType.EOF)
        // aqui parsea las instrucciones dentro del if
        cons.push(this.parseStatement());
      this.consume(TokenType.PUNC, "}");
      return { type: "If", test, body: cons };
    }

    // Si ve un ID, asume que es una asignación
    if (t.type === TokenType.ID) {
      const id = this.consume(TokenType.ID).value;
      this.consume(TokenType.OP, "=");
      // Parsea la expresión del lado derecho
      const right = this.parseExpression();
      this.consume(TokenType.PUNC, ";");
      return { type: "Assign", left: id, right };
    }

    // si ve un function crea una estructura de funcion
    if (t.type === TokenType.KEYWORD && t.value === "function") {
      this.consume(TokenType.KEYWORD);
      const id = this.consume(TokenType.ID).value;
      this.consume(TokenType.PUNC, "(");
      const params = [];
      while (this.peek().value !== ")") {
        params.push(this.consume(TokenType.ID).value);
        if (this.peek().value === ",") this.consume(TokenType.PUNC, ",");
      }
      this.consume(TokenType.PUNC, ")");
      this.consume(TokenType.PUNC, "{");
      const body = [];
      while (this.peek().value !== "}" && this.peek().type !== TokenType.EOF)
        body.push(this.parseStatement());
      this.consume(TokenType.PUNC, "}");
      return { type: "Function", id, params, body };
    }

    // Si no reconoce la instrucción, lanza un error
    throw new Error(
      `Instrucción no reconocida en línea ${t.line}: '${t.value}'`
    );
  }

  // manejo de las preceddencias de operadores y estan anidadas
  // primero las relacionales
  parseExpression() {
    let left = this.parseAddition();
    // Mientras haya operadores relacionales
    while ([">", "<", ">=", "<=", "==", "!="].includes(this.peek().value)) {
      const operator = this.consume(TokenType.OP).value;
      // Parsea la expresión del lado derecho
      const right = this.parseAddition();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  // Maneja la precedencia de operadores de adición (+ y -)
  parseAddition() {
    let left = this.parseTerm();
    // Mientras haya operadores + o -
    while (this.peek().value === "+" || this.peek().value === "-") {
      const operator = this.consume(TokenType.OP).value;
      // Parsea la expresión del lado derecho
      const right = this.parseTerm();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  // Maneja la precedencia de operadores de multiplicación (* y /)
  parseTerm() {
    let left = this.parseF();
    // Mientras haya operadores * o /
    while (this.peek().value === "*" || this.peek().value === "/") {
      const operator = this.consume(TokenType.OP).value;
      // Parsea la expresión del lado derecho
      const right = this.parseF();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  // Maneja los factores: números, identificadores y expresiones entre paréntesis
  parseF() {
    const t = this.peek();

    // Soporte para un único signo negativo (Operador Unario)
    if (t.type === TokenType.OP && t.value === "-") {
      this.consume(TokenType.OP, "-");
      const nextToken = this.peek();

      // Verificamos que lo que sigue NO sea otro operador
      if (nextToken.type === TokenType.OP) {
        throw new Error(
          `Error de Sintaxis (Línea ${nextToken.line}): No se permite el operador '${nextToken.value}' después de un signo negativo.`
        );
      }

      // Si no es operador, procesamos lo que sigue (ID, NUM o Paréntesis)
      const val = this.parsePrimary();
      return { type: "Unary", operator: "-", argument: val };
    }

    return this.parsePrimary();
  }

  // función auxiliar para evitar la recursividad infinita de signos
  // función auxiliar modificada para detectar llamadas a funciones
  parsePrimary() {
    const t = this.peek();

    if (t.type === TokenType.NUM) {
      this.consume(TokenType.NUM);
      return { type: "Literal", value: t.value };
    }

    // AQUI ESTA EL CAMBIO PARA EL FACTORIAL
    if (t.type === TokenType.ID) {
      const name = this.consume(TokenType.ID).value;

      // Si después del ID hay un '(', es una llamada a función: factorial(n-1)
      if (this.peek().value === "(") {
        this.consume(TokenType.PUNC, "(");
        const args = [];
        // Si no se cierra inmediatamente, hay argumentos
        if (this.peek().value !== ")") {
          // Parseamos el primer argumento
          args.push(this.parseExpression());
          // Mientras haya comas, seguimos parseando argumentos
          while (this.peek().value === ",") {
            this.consume(TokenType.PUNC, ",");
            args.push(this.parseExpression());
          }
        }
        this.consume(TokenType.PUNC, ")");
        return { type: "CallExpression", callee: name, args };
      }

      // Si no hay '(', es solo una variable normal
      return { type: "ID", name: name };
    }

    if (t.value === "(") {
      this.consume(TokenType.PUNC, "(");
      const expr = this.parseExpression();
      this.consume(TokenType.PUNC, ")");
      return expr;
    }

    throw new Error(
      `Se esperaba un valor o expresión, pero se encontró '${t.value}'`
    );
  }
}

// --- 3. RENDERIZADO, Estas funciones toman el resultado del Parser (el AST) y lo convierten en HTML para mostrarlo en pantalla. ---
// Crea un pequeño div HTML para representar un nodo del árbol.
function createNode(label, sub, type) {
  const div = document.createElement("div");
  div.className = "node-content";
  if (type === "ERROR_NODE") div.className += " error-node";
  div.innerHTML = label + (sub ? `<span class="node-sub">${sub}</span>` : "");
  return div;
}

// Es una función recursiva.
function renderTree(node) {
  if (!node) return null;
  
  const li = document.createElement("li");
  // Dependiendo del tipo de nodo, extrae la información relevante y los hijos.
  let label = node.type,
    sub = "",
    children = [];

  // Maneja los diferentes tipos de nodos del AST
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
    case "Unary":
      label = node.operator;
      sub = "unario";
      children = [node.argument];
      break;
    case "Function":
      label = "Function";
      sub = node.id + "(" + node.params.join(", ") + ")";
      children = node.body;
      break;
    case "Return":
      label = "Return";
      sub = "←";
      children = [node.argument]; // Muestra la expresión hija
      break;

    case "ConsoleLog":
      label = "Console.log";
      sub = "🖨️";
      children = [node.argument];
      break;

    case "CallExpression":
      label = "Call"; // Llamada a función
      sub = node.callee + "()";
      children = node.args; // Muestra los argumentos como hijos
      break;

    // VISUALIZACIÓN PARA TRY-CATCH
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

  // Crea el nodo HTML y procesa recursivamente los hijos.
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

// --- 4. APP. Esta es la capa que une todo con la interfaz de usuario (HTML). ---
// Esta es la función maestra que orquesta todo
function compile() {
  const code = document.getElementById("code").value;
  const consoleEl = document.getElementById("console-content");
  const astEl = document.getElementById("ast-view");
  const tokensEl = document.getElementById("tokens-content");
  consoleEl.innerHTML = "";
  astEl.innerHTML = "";
  tokensEl.innerHTML = "";

  try {
    // incializa el lexer y tokeniza el código
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();

    // generacion de la tabla de tokens
    let tableHtml = `<table class="token-table"><thead><tr><th>Token</th><th>Lexema</th><th>Patrón</th></tr></thead><tbody>`;
    const vistos = new Set();
    // Genera la tabla de tokens
    tokens.forEach((t) => {
      if (t.type !== "EOF" && !vistos.has(t.value)) {
        vistos.add(t.value);
        const info = TokenInfo[t.type] || { nombre: t.type, patron: "-" };
        tableHtml += `<tr><td class="col-token">${info.nombre}</td><td class="col-lexema">${t.value}</td><td class="col-patron">${info.patron}</td></tr>`;
      }
    });
    tokensEl.innerHTML = tableHtml + "</tbody></table>";

    // instacia el parser pasandole los tokens
    const parser = new Parser(tokens);
    // genera el AST
    const ast = parser.parse();
    // renderiza el AST en HTML
    const root = document.createElement("ul");
    root.appendChild(renderTree(ast));
    astEl.appendChild(root);

    // muestra errores si los hay
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

// Manejo de pestañas
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

// --- 5. IMPORTACIÓN DE ARCHIVOS ---

// Listener para el input de archivos
document
  .getElementById("fileInput")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    // Cuando el archivo se termine de leer
    reader.onload = function (e) {
      const content = e.target.result;

      // 1. Poner el contenido en el textarea
      document.getElementById("code").value = content;

      // 2. Limpiar la consola para feedback visual
      document.getElementById(
        "console-content"
      ).innerHTML = `<div class="log-entry" style="color: #6a9955">ℹ️ Archivo cargado: ${file.name}</div>`;

      // 3. Compilar automáticamente
      compile();
    };

    // Leer el archivo como texto plano
    reader.readAsText(file);

    // Resetear el valor del input para permitir cargar el mismo archivo dos veces si se desea
    event.target.value = "";
  });
