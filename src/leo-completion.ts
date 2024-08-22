import * as vscode from 'vscode';
//import { Token, tokenize } from './leo-tokenizer';
import { Token, tokenize } from './leo-tokenizer.js';
import { TypeInferenceEngine, LeoType } from './leo-type-inference.js';

interface ScopeSymbol {
    name: string;
    kind: vscode.CompletionItemKind;
    type: LeoType;
}

class Scope {
    symbols: ScopeSymbol[] = [];
    parent: Scope | null = null;

    constructor(parent?: Scope) {
        this.parent = parent || null;
    }

    addSymbol(symbol: ScopeSymbol) {
        this.symbols.push(symbol);
    }

    findSymbol(name: string): ScopeSymbol | undefined {
        return this.symbols.find(s => s.name === name) || this.parent?.findSymbol(name);
    }

    getAllSymbols(): ScopeSymbol[] {
        return [...this.symbols, ...(this.parent?.getAllSymbols() || [])];
    }
}


export class LeoCompletionItemProvider implements vscode.CompletionItemProvider {
    private globalScope: Scope = new Scope();
    private typeInferenceEngine: TypeInferenceEngine = new TypeInferenceEngine();

    constructor() {
        this.initializeGlobalScope();
    }

    private initializeGlobalScope() {
        const globalSymbols: ScopeSymbol[] = [
            { name: 'assert', kind: vscode.CompletionItemKind.Function, type: 'unknown' },
            { name: 'assert_eq', kind: vscode.CompletionItemKind.Function, type: 'unknown' },
            { name: 'assert_neq', kind: vscode.CompletionItemKind.Function, type: 'unknown' },
            // Add more global functions and types here
        ];

        globalSymbols.forEach(symbol => {
            this.globalScope.addSymbol(symbol);
            this.typeInferenceEngine.updateTypeMap(symbol.name, symbol.type);
        });
    }




    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const tokens = tokenize(document.getText());
        const currentScope = this.analyzeScope(tokens, document.offsetAt(position));

        if (this.isStartOfLine(linePrefix)) {
            return this.getKeywordCompletions();
        }

        if (this.isAfterDot(linePrefix)) {
            return this.getMethodCompletions(linePrefix, currentScope, tokens, document.offsetAt(position));
        }

        return this.getGeneralCompletions(currentScope);
    }


    private getMethodCompletions(linePrefix: string, scope: Scope, tokens: { token: Token; value: string }[], position: number): vscode.CompletionItem[] {
        const objectName = linePrefix.trim().split('.')[0];
        const objectSymbol = scope.findSymbol(objectName);

        if (objectSymbol) {
            const inferredType = this.typeInferenceEngine.inferType(tokens, this.findTokenIndexByPosition(tokens, position)).type;
            return this.getTypeSpecificMethods(inferredType);
        }

        // Default methods if we can't determine the type
        const defaultMethods = ['len', 'push', 'pop', 'remove'];
        return defaultMethods.map(method => new vscode.CompletionItem(method, vscode.CompletionItemKind.Method));
    }


    private getTypeSpecificMethods(type: LeoType): vscode.CompletionItem[] {
        switch (type) {
            case 'array':
                return ['len', 'push', 'pop', 'remove'].map(method => new vscode.CompletionItem(method, vscode.CompletionItemKind.Method));
            case 'string':
                return ['len', 'at', 'chars'].map(method => new vscode.CompletionItem(method, vscode.CompletionItemKind.Method));
            case 'u8':
            case 'u16':
            case 'u32':
            case 'u64':
            case 'u128':
            case 'i8':
            case 'i16':
            case 'i32':
            case 'i64':
            case 'i128':
            case 'field':
            case 'scalar':
                return ['pow', 'div', 'mul', 'add', 'sub'].map(method => new vscode.CompletionItem(method, vscode.CompletionItemKind.Method));
            case 'group':
                return ['generator', 'zero', 'mul', 'add', 'sub', 'neg'].map(method => new vscode.CompletionItem(method, vscode.CompletionItemKind.Method));
            // Add more type-specific methods here
            default:
                return [];
        }
    }

    private isStartOfLine(linePrefix: string): boolean {
        return linePrefix.trim().length === 0;
    }

    private isAfterDot(linePrefix: string): boolean {
        return linePrefix.trim().endsWith('.');
    }

    private getKeywordCompletions(): vscode.CompletionItem[] {
        const keywords = ['function', 'transition', 'inline', 'struct', 'record', 'mapping', 'if', 'else', 'for', 'return', 'let', 'const'];
        return keywords.map(keyword => new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword));
    }

    /*

    private getMethodCompletions(linePrefix: string, scope: Scope): vscode.CompletionItem[] {
        const objectName = linePrefix.trim().split('.')[0];
        const objectSymbol = scope.findSymbol(objectName);

        if (objectSymbol && objectSymbol.type) {
            return this.getTypeSpecificMethods(objectSymbol.type);
        }

        // Default methods if we can't determine the type
        const defaultMethods = ['len', 'push', 'pop', 'remove'];
        return defaultMethods.map(method => new vscode.CompletionItem(method, vscode.CompletionItemKind.Method));
    }
*/


    private getGeneralCompletions(scope: Scope): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // Add type completions
        const types = ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'field', 'group', 'scalar', 'string', 'bool', 'address'];
        types.forEach(type => {
            completions.push(new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter));
        });

        // Add completions for all symbols in the current scope
        scope.getAllSymbols().forEach(symbol => {
            const item = new vscode.CompletionItem(symbol.name, symbol.kind);
            if (symbol.type) {
                item.detail = symbol.type;
            }
            completions.push(item);
        });

        return completions;
    }


    private analyzeScope(tokens: { token: Token; value: string }[], position: number): Scope {
        let currentScope = new Scope(this.globalScope);
        let braceCount = 0;

        for (let i = 0; i < tokens.length; i++) {
            const { token, value } = tokens[i];

            if (token === Token.LeftCurly) {
                braceCount++;
                currentScope = new Scope(currentScope);
            } else if (token === Token.RightCurly) {
                braceCount--;
                if (currentScope.parent) {
                    currentScope = currentScope.parent;
                }
            } else if (token === Token.Let || token === Token.Const) {
                // Variable declaration analysis with enhanced type inference
                if (i + 2 < tokens.length && tokens[i + 1].token === Token.Identifier) {
                    const varName = tokens[i + 1].value;
                    const inferredType = this.typeInferenceEngine.inferType(tokens, i + 2).type;
                    currentScope.addSymbol({
                        name: varName,
                        kind: vscode.CompletionItemKind.Variable,
                        type: inferredType
                    });
                    this.typeInferenceEngine.updateTypeMap(varName, inferredType);
                }
            } else if (token === Token.Function || token === Token.Transition || token === Token.Inline) {
                // Function declaration analysis with return type inference
                if (i + 1 < tokens.length && tokens[i + 1].token === Token.Identifier) {
                    const funcName = tokens[i + 1].value;
                    const returnType = this.typeInferenceEngine.inferFunctionReturnType(tokens, i);
                    currentScope.addSymbol({
                        name: funcName,
                        kind: vscode.CompletionItemKind.Function,
                        type: returnType
                    });
                    this.typeInferenceEngine.updateFunctionReturnType(funcName, returnType);
                }
            }

            // Check if we've passed the current position
            if (i >= position) {
                break;
            }
        }

        return currentScope;
    }

    private findTokenIndexByPosition(tokens: { token: Token; value: string }[], position: number): number {
        let currentPosition = 0;
        for (let i = 0; i < tokens.length; i++) {
            currentPosition += tokens[i].value.length;
            if (currentPosition >= position) {
                return i;
            }
        }
        return tokens.length - 1;
    }

}

export function activate(context: vscode.ExtensionContext) {
    const provider = new LeoCompletionItemProvider();
    const disposable = vscode.languages.registerCompletionItemProvider('leo', provider, '.');
    context.subscriptions.push(disposable);
}