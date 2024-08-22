
enum Token {
    // Comments
    CommentLine,
    CommentBlock,

    // Whitespace
    WhiteSpace,

    // Literals
    True,
    False,
    Integer,
    AddressLit,
    StaticString,

    // Identifiers
    Identifier,

    // Symbols
    Not,
    NotEq,
    And,
    AndAssign,
    Or,
    OrAssign,
    BitAnd,
    BitAndAssign,
    BitOr,
    BitOrAssign,
    BitXor,
    BitXorAssign,
    Eq,
    Assign,
    Lt,
    LtEq,
    Gt,
    GtEq,
    Add,
    AddAssign,
    Sub,
    SubAssign,
    Mul,
    MulAssign,
    Div,
    DivAssign,
    Pow,
    PowAssign,
    Rem,
    RemAssign,
    Shl,
    ShlAssign,
    Shr,
    ShrAssign,
    LeftParen,
    RightParen,
    LeftSquare,
    RightSquare,
    LeftCurly,
    RightCurly,
    Comma,
    Dot,
    DotDot,
    Semicolon,
    Colon,
    DoubleColon,
    Question,
    Arrow,
    BigArrow,
    Underscore,
    At,

    // Keywords
    Address,
    Aleo,
    As,
    Assert,
    // ... (other keywords)




}

function tokenize(input: string): { token: Token; value: string }[] {
    const tokens: { token: Token; value: string }[] = [];
    let position = 0;

    while (position < input.length) {
        const char = input[position];

        // Whitespace
        if (/\s/.test(char)) {
            const start = position;
            while (position < input.length && /\s/.test(input[position])) {
                position++;
            }
            tokens.push({ token: Token.WhiteSpace, value: input.slice(start, position) });
            continue;
        }

        // Comments
        if (char === '/' && position + 1 < input.length) {
            if (input[position + 1] === '/') {
                const start = position;
                position += 2;
                while (position < input.length && input[position] !== '\n') {
                    position++;
                }
                tokens.push({ token: Token.CommentLine, value: input.slice(start, position) });
                continue;
            } else if (input[position + 1] === '*') {
                const start = position;
                position += 2;
                while (position + 1 < input.length && !(input[position] === '*' && input[position + 1] === '/')) {
                    position++;
                }
                position += 2;
                tokens.push({ token: Token.CommentBlock, value: input.slice(start, position) });
                continue;
            }
        }

        // Identifiers and Keywords
        if (/[a-zA-Z_]/.test(char)) {
            const start = position;
            while (position < input.length && /[a-zA-Z0-9_]/.test(input[position])) {
                position++;
            }
            const value = input.slice(start, position);
            const token = getKeywordOrIdentifier(value);
            tokens.push({ token, value });
            continue;
        }

        // Numbers
        if (/\d/.test(char)) {
            const start = position;
            while (position < input.length && /[\d_]/.test(input[position])) {
                position++;
            }
            tokens.push({ token: Token.Integer, value: input.slice(start, position) });
            continue;
        }

        // Strings
        if (char === '"') {
            const start = position;
            position++;
            while (position < input.length && input[position] !== '"') {
                position++;
            }
            position++;
            tokens.push({ token: Token.StaticString, value: input.slice(start, position) });
            continue;
        }

        // Symbols
        const symbolToken = getSymbolToken(input.slice(position));
        if (symbolToken) {
            tokens.push(symbolToken);
            position += symbolToken.value.length;
            continue;
        }

        // Unrecognized character
        position++;
    }

    return tokens;
}

function getKeywordOrIdentifier(value: string): Token {
    switch (value) {
        case 'true': return Token.True;
        case 'false': return Token.False;
        case 'address': return Token.Address;
        case 'aleo': return Token.Aleo;
        case 'as': return Token.As;
        case 'assert': return Token.Assert;
        // ... (other keywords)
        default:
            if (/^aleo1/.test(value)) {
                return Token.AddressLit;
            }
            return Token.Identifier;
    }
}

    function getSymbolToken(input: string): { token: Token; value: string } | null {
        const symbolPatterns: [RegExp, Token][] = [
            [/^!=/, Token.NotEq],
            [/^!/, Token.Not],
            [/^&&=/, Token.AndAssign],
            [/^&&/, Token.And],
            [/^&=/, Token.BitAndAssign],
            [/^&/, Token.BitAnd],
            [/^\|\|=/, Token.OrAssign],
            [/^\|\|/, Token.Or],
            [/^\|=/, Token.BitOrAssign],
            [/^\|/, Token.BitOr],
            [/^\^=/, Token.BitXorAssign],
            [/^\^/, Token.BitXor],
            [/^==/, Token.Eq],
            [/^=/, Token.Assign],
            [/^<=/, Token.LtEq],
            [/^<<=/, Token.ShlAssign],
            [/^<</, Token.Shl],
            [/^</, Token.Lt],
            [/^>=/, Token.GtEq],
            [/^>>=/, Token.ShrAssign],
            [/^>>/, Token.Shr],
            [/^>/, Token.Gt],
            [/^\+\=/, Token.AddAssign],
            [/^\+/, Token.Add],
            [/^-=/, Token.SubAssign],
            [/^->/, Token.Arrow],
            [/^-/, Token.Sub],
            [/^\*\*=/, Token.PowAssign],
            [/^\*\*/, Token.Pow],
            [/^\*=/, Token.MulAssign],
            [/^\*/, Token.Mul],
            [/^\/=/, Token.DivAssign],
            [/^\//, Token.Div],
            [/^%=/, Token.RemAssign],
            [/^%/, Token.Rem],
            [/^\(/, Token.LeftParen],
            [/^\)/, Token.RightParen],
            [/^\[/, Token.LeftSquare],
            [/^\]/, Token.RightSquare],
            [/^{/, Token.LeftCurly],
            [/^}/, Token.RightCurly],
            [/^,/, Token.Comma],
            [/^\.\./, Token.DotDot],
            [/^\./, Token.Dot],
            [/^;/, Token.Semicolon],
            [/^::/, Token.DoubleColon],
            [/^:/, Token.Colon],
            [/^\?/, Token.Question],
            [/^=>/, Token.BigArrow],
            [/^_/, Token.Underscore],
            [/^@/, Token.At],
        ];
    
        for (const [pattern, token] of symbolPatterns) {
            const match = input.match(pattern);
            if (match) {
                return { token, value: match[0] };
            }
        }
    
        return null;
    }

export { Token, tokenize };