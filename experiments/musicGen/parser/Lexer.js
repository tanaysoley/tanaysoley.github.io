const Token = {
  Note: "Note",
  Plus: "Plus",
  Minus: "Minus",
  LBracket: "LBracket",
  RBracket: "RBracket",
  LBrace: "LBrace",
  RBrace: "RBrace",
  LParen: "LParen",
  RParen: "RParen",
  Comma: "Comma",
  Identifier: "Identifier",
  EOF: "EOF",
};

class Lexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.length = input.length;
  }

  tokenize() {
    const tokens = [];
    while (this.pos < this.length) {
      const c = this.input[this.pos];
      if (/\s/.test(c)) {
        this.pos++;
        continue;
      }
      switch (c) {
        case "+":
          tokens.push({ type: Token.Plus });
          this.pos++;
          break;
        case "-":
          tokens.push({ type: Token.Minus });
          this.pos++;
          break;
        case "[":
          tokens.push({ type: Token.LBracket });
          this.pos++;
          break;
        case "]":
          tokens.push({ type: Token.RBracket });
          this.pos++;
          break;
        case "{":
          tokens.push({ type: Token.LBrace });
          this.pos++;
          break;
        case "}":
          tokens.push({ type: Token.RBrace });
          this.pos++;
          break;
        case "(":
          tokens.push({ type: Token.LParen });
          this.pos++;
          break;
        case ")":
          tokens.push({ type: Token.RParen });
          this.pos++;
          break;
        case ",":
          tokens.push({ type: Token.Comma });
          this.pos++;
          break;
        default:
          if (/[a-zA-Z0-9]/.test(c)) {
            tokens.push(this.readWord());
          } else {
            throw new Error(`Unexpected character '${c}' at pos ${this.pos}`);
          }
      }
    }
    tokens.push({ type: Token.EOF });
    return tokens;
  }

  readWord() {
    const start = this.pos;
    while (
      this.pos < this.length &&
      /[a-zA-Z0-9#]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    const word = this.input.substring(start, this.pos);
    switch (word.toLowerCase()) {
      case "begin":
      case "end":
      case "tempo":
      case "title":
        return { type: Token.Identifier, name: word.toLowerCase() };
      default:
        return { type: Token.Note, value: word };
    }
  }
}

export { Lexer, Token };
