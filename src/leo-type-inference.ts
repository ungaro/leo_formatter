//import { Token } from './leo-tokenizer';
import { Token, tokenize } from './leo-tokenizer.js';

export type LeoType = 
    | 'u8' | 'u16' | 'u32' | 'u64' | 'u128'
    | 'i8' | 'i16' | 'i32' | 'i64' | 'i128'
    | 'field' | 'group' | 'scalar'
    | 'bool' | 'address' | 'string'
    | 'array' | 'struct' | 'unknown';

interface TypedExpression {
    expression: string;
    type: LeoType;
}

export class TypeInferenceEngine {
    private typeMap: Map<string, LeoType> = new Map();
    private functionReturnTypes: Map<string, LeoType> = new Map();

    inferType(tokens: { token: Token; value: string }[], startIndex: number): TypedExpression {
        const result = this.inferTypeRecursive(tokens, startIndex);
        return { 
            expression: tokens.slice(startIndex, result.endIndex + 1).map(t => t.value).join(' '),
            type: result.type
        };
    }

    private inferTypeRecursive(tokens: { token: Token; value: string }[], startIndex: number): { type: LeoType, endIndex: number } {
        let currentIndex = startIndex;

        const token = tokens[currentIndex];
        switch (token.token) {
            case Token.Identifier:
                const knownType = this.typeMap.get(token.value);
                if (knownType) return { type: knownType, endIndex: currentIndex };
                break;
            case Token.Integer:
                return { type: this.inferIntegerType(token.value), endIndex: currentIndex };
            case Token.True:
            case Token.False:
                return { type: 'bool', endIndex: currentIndex };
            case Token.StaticString:
                return { type: 'string', endIndex: currentIndex };
            case Token.LeftSquare:
                return this.inferArrayType(tokens, currentIndex);
            case Token.LeftParen:
                return this.inferParenthesizedExpression(tokens, currentIndex);
        }

        // Handle function calls
        if (token.token === Token.Identifier && currentIndex + 1 < tokens.length && tokens[currentIndex + 1].token === Token.LeftParen) {
            return this.inferFunctionCall(tokens, currentIndex);
        }

        // Handle binary operations
        const binaryOpResult = this.inferBinaryOperation(tokens, currentIndex);
        if (binaryOpResult) return binaryOpResult;

        return { type: 'unknown', endIndex: currentIndex };
    }

    private inferIntegerType(value: string): LeoType {
        if (value.endsWith('u8')) return 'u8';
        if (value.endsWith('u16')) return 'u16';
        if (value.endsWith('u32')) return 'u32';
        if (value.endsWith('u64')) return 'u64';
        if (value.endsWith('u128')) return 'u128';
        if (value.endsWith('i8')) return 'i8';
        if (value.endsWith('i16')) return 'i16';
        if (value.endsWith('i32')) return 'i32';
        if (value.endsWith('i64')) return 'i64';
        if (value.endsWith('i128')) return 'i128';
        return 'field'; // Default to field if no suffix
    }

    private inferArrayType(tokens: { token: Token; value: string }[], startIndex: number): { type: LeoType, endIndex: number } {
        let currentIndex = startIndex + 1;
        let elementType: LeoType = 'unknown';

        while (currentIndex < tokens.length && tokens[currentIndex].token !== Token.RightSquare) {
            const result = this.inferTypeRecursive(tokens, currentIndex);
            if (elementType === 'unknown') {
                elementType = result.type;
            } else if (elementType !== result.type) {
                elementType = 'unknown'; // Mixed types in array
                break;
            }
            currentIndex = result.endIndex + 1;
            if (tokens[currentIndex].token === Token.Comma) currentIndex++;
        }

        return { type: 'array', endIndex: currentIndex };
    }

    private inferParenthesizedExpression(tokens: { token: Token; value: string }[], startIndex: number): { type: LeoType, endIndex: number } {
        const result = this.inferTypeRecursive(tokens, startIndex + 1);
        let endIndex = result.endIndex;
        while (endIndex < tokens.length && tokens[endIndex].token !== Token.RightParen) {
            endIndex++;
        }
        return { type: result.type, endIndex };
    }

    private inferFunctionCall(tokens: { token: Token; value: string }[], startIndex: number): { type: LeoType, endIndex: number } {
        const functionName = tokens[startIndex].value;
        const returnType = this.functionReturnTypes.get(functionName) || 'unknown';
        let currentIndex = startIndex + 1;
        let parenCount = 1;

        while (currentIndex < tokens.length && parenCount > 0) {
            if (tokens[currentIndex].token === Token.LeftParen) parenCount++;
            if (tokens[currentIndex].token === Token.RightParen) parenCount--;
            currentIndex++;
        }

        return { type: returnType, endIndex: currentIndex - 1 };
    }


    private inferBinaryOperation(tokens: { token: Token; value: string }[], startIndex: number): { type: LeoType, endIndex: number } | null {
        const leftResult = this.inferTypeRecursive(tokens, startIndex);
        let currentIndex = leftResult.endIndex + 1;

        if (currentIndex >= tokens.length) return null;

        const operatorToken = tokens[currentIndex];
        if (!this.isBinaryOperator(operatorToken.token)) return null;

        const rightResult = this.inferTypeRecursive(tokens, currentIndex + 1);

        const resultType = this.getBinaryOperationResultType(leftResult.type, operatorToken.token, rightResult.type);
        return { type: resultType, endIndex: rightResult.endIndex };
    }

    private isBinaryOperator(token: Token): boolean {
        return [Token.Add, Token.Sub, Token.Mul, Token.Div, Token.Rem, Token.Pow, 
                Token.And, Token.Or, Token.BitAnd, Token.BitOr, Token.BitXor, 
                Token.Eq, Token.NotEq, Token.Lt, Token.LtEq, Token.Gt, Token.GtEq].includes(token);
    }

    private getBinaryOperationResultType(leftType: LeoType, operator: Token, rightType: LeoType): LeoType {
        // Arithmetic operations
        if ([Token.Add, Token.Sub, Token.Mul, Token.Div, Token.Rem, Token.Pow].includes(operator)) {
            if (leftType === rightType && this.isNumericType(leftType)) return leftType;
            return 'field'; // Default to field for mixed numeric types
        }

        // Bitwise operations
        if ([Token.BitAnd, Token.BitOr, Token.BitXor].includes(operator)) {
            if (leftType === rightType && this.isIntegerType(leftType)) return leftType;
            return 'unknown';
        }

        // Logical operations
        if ([Token.And, Token.Or].includes(operator)) {
            if (leftType === 'bool' && rightType === 'bool') return 'bool';
            return 'unknown';
        }

        // Comparison operations
        if ([Token.Eq, Token.NotEq, Token.Lt, Token.LtEq, Token.Gt, Token.GtEq].includes(operator)) {
            return 'bool';
        }

        return 'unknown';
    }

    private isNumericType(type: LeoType): boolean {
        return ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'field', 'scalar'].includes(type);
    }

    private isIntegerType(type: LeoType): boolean {
        return ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(type);
    }

    updateTypeMap(name: string, type: LeoType) {
        this.typeMap.set(name, type);
    }

    updateFunctionReturnType(name: string, type: LeoType) {
        this.functionReturnTypes.set(name, type);
    }

    inferFunctionReturnType(tokens: { token: Token; value: string }[], startIndex: number): LeoType {
        let currentIndex = startIndex;
        let braceCount = 0;

        while (currentIndex < tokens.length) {
            const { token, value } = tokens[currentIndex];

            if (token === Token.LeftCurly) {
                braceCount++;
            } else if (token === Token.RightCurly) {
                braceCount--;
                if (braceCount === 0) break;
            } else if (token === Token.Return) {
                const returnExpression = this.inferType(tokens, currentIndex + 1);
                return returnExpression.type;
            }

            currentIndex++;
        }

        return 'unknown';
    }

}