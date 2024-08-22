import * as vscode from 'vscode';
import { Token, tokenize } from './leo-tokenizer.js';
import { LeoCompletionItemProvider } from './leo-completion.js';

interface FormatterConfig {
    indentSize: number;
    useTabs: boolean;
    maxLineLength: number;
    insertSpaceBeforeBrace: boolean;
    insertSpaceInParentheses: boolean;
}


class LeoFormatter {
    private indentationLevel: number = 0;
    private config: FormatterConfig;


	constructor(config: FormatterConfig) {
        this.config = config;
    }

	private get indentationString(): string {
        return this.config.useTabs ? '\t' : ' '.repeat(this.config.indentSize);
    }

	format(code: string): string {
        try {
            const tokens = tokenize(code);
            let formattedCode = '';
            let i = 0;

            while (i < tokens.length) {
                const { token, value } = tokens[i];

                try {
                    switch (token) {
                        case Token.Function:
                        case Token.Transition:
                        case Token.Inline:
                            [formattedCode, i] = this.formatFunctionDeclaration(tokens, i);
                            break;
                        case Token.Struct:
                        case Token.Record:
                            [formattedCode, i] = this.formatStructOrRecordDeclaration(tokens, i);
                            break;
                        case Token.Mapping:
                            [formattedCode, i] = this.formatMappingDeclaration(tokens, i);
                            break;
                        case Token.If:
                            [formattedCode, i] = this.formatIfStatement(tokens, i);
                            break;
                        case Token.For:
                            [formattedCode, i] = this.formatForLoop(tokens, i);
                            break;
                        default:
                            formattedCode += this.formatToken(token, value);
                            i++;
                    }
                } catch (error) {
                    console.error(`Error formatting token ${token} at position ${i}:`, error);
                    // Skip the problematic token and continue
                    formattedCode += value;
                    i++;
                }
            }

            return this.wrapLines(formattedCode);
        } catch (error) {
            console.error('Error during formatting:', error);
            // Return the original code if formatting fails
            return code;
        }
    }

	private formatToken(token: Token, value: string): string {
        switch (token) {
            case Token.WhiteSpace:
                return value.includes('\n') ? '\n' + this.getIndentation() : ' ';
            case Token.CommentLine:
                return value.trim() + '\n' + this.getIndentation();
            case Token.CommentBlock:
                return this.formatBlockComment(value);
            case Token.LeftCurly:
                return (this.config.insertSpaceBeforeBrace ? ' ' : '') + '{' + '\n' + this.getIndentation();
            case Token.RightCurly:
                this.indentationLevel--;
                return '\n' + this.getIndentation() + '}';
            case Token.Semicolon:
                return ';\n' + this.getIndentation();
            case Token.Comma:
                return ', ';
            default:
                return value;
        }
    }

	private formatFunctionDeclaration(tokens: { token: Token; value: string }[], startIndex: number): [string, number] {
        let formatted = '';
        let i = startIndex;

        // Format function signature
        while (i < tokens.length && tokens[i].token !== Token.LeftCurly) {
            formatted += this.formatToken(tokens[i].token, tokens[i].value);
            i++;
        }

        // Format function body
        if (i < tokens.length && tokens[i].token === Token.LeftCurly) {
            formatted += this.formatToken(Token.LeftCurly, '{');
            this.indentationLevel++;
            i++;

            while (i < tokens.length && tokens[i].token !== Token.RightCurly) {
                formatted += this.formatToken(tokens[i].token, tokens[i].value);
                i++;
            }

            if (i < tokens.length && tokens[i].token === Token.RightCurly) {
                formatted += this.formatToken(Token.RightCurly, '}');
                i++;
            }
        }

        return [formatted, i];
    }


	private formatStructOrRecordDeclaration(tokens: { token: Token; value: string }[], startIndex: number): [string, number] {
        let formatted = '';
        let i = startIndex;

        // Format struct/record name
        while (i < tokens.length && tokens[i].token !== Token.LeftCurly) {
            formatted += this.formatToken(tokens[i].token, tokens[i].value);
            i++;
        }

        // Format struct/record body
        if (i < tokens.length && tokens[i].token === Token.LeftCurly) {
            formatted += this.formatToken(Token.LeftCurly, '{');
            this.indentationLevel++;
            i++;

            while (i < tokens.length && tokens[i].token !== Token.RightCurly) {
                formatted += this.formatToken(tokens[i].token, tokens[i].value);
                i++;
            }

            if (i < tokens.length && tokens[i].token === Token.RightCurly) {
                formatted += this.formatToken(Token.RightCurly, '}');
                i++;
            }
        }

        return [formatted, i];
    }


	private formatMappingDeclaration(tokens: { token: Token; value: string }[], startIndex: number): [string, number] {
        let formatted = '';
        let i = startIndex;

        while (i < tokens.length && tokens[i].token !== Token.Semicolon) {
            formatted += this.formatToken(tokens[i].token, tokens[i].value);
            i++;
        }

        if (i < tokens.length && tokens[i].token === Token.Semicolon) {
            formatted += this.formatToken(Token.Semicolon, ';');
            i++;
        }

        return [formatted, i];
    }


	private formatIfStatement(tokens: { token: Token; value: string }[], startIndex: number): [string, number] {
        let formatted = 'if ';
        let i = startIndex + 1;

        // Format condition
        while (i < tokens.length && tokens[i].token !== Token.LeftCurly) {
            formatted += this.formatToken(tokens[i].token, tokens[i].value);
            i++;
        }

        // Format if body
        if (i < tokens.length && tokens[i].token === Token.LeftCurly) {
            [formatted, i] = this.formatBlock(tokens, i, formatted);
        }

        // Check for else
        if (i < tokens.length && tokens[i].token === Token.Else) {
            formatted += ' else';
            i++;

            if (i < tokens.length && tokens[i].token === Token.If) {
                // else if
                let [elseIfFormatted, newIndex] = this.formatIfStatement(tokens, i);
                formatted += ' ' + elseIfFormatted;
                i = newIndex;
            } else if (i < tokens.length && tokens[i].token === Token.LeftCurly) {
                // else block
                [formatted, i] = this.formatBlock(tokens, i, formatted);
            }
        }

        return [formatted, i];
    }

	private formatForLoop(tokens: { token: Token; value: string }[], startIndex: number): [string, number] {
        let formatted = 'for ';
        let i = startIndex + 1;

        // Format loop header
        while (i < tokens.length && tokens[i].token !== Token.LeftCurly) {
            formatted += this.formatToken(tokens[i].token, tokens[i].value);
            i++;
        }

        // Format loop body
        if (i < tokens.length && tokens[i].token === Token.LeftCurly) {
            [formatted, i] = this.formatBlock(tokens, i, formatted);
        }

        return [formatted, i];
    }

	private formatBlock(tokens: { token: Token; value: string }[], startIndex: number, prefix: string): [string, number] {
        let formatted = prefix + this.formatToken(Token.LeftCurly, '{');
        this.indentationLevel++;
        let i = startIndex + 1;

        while (i < tokens.length && tokens[i].token !== Token.RightCurly) {
            formatted += this.formatToken(tokens[i].token, tokens[i].value);
            i++;
        }

        if (i < tokens.length && tokens[i].token === Token.RightCurly) {
            formatted += this.formatToken(Token.RightCurly, '}');
            i++;
        }

        return [formatted, i];
    }

	private getIndentation(): string {
        return this.indentationString.repeat(this.indentationLevel);
    }


    private formatBlockComment(comment: string): string {
        const lines = comment.split('\n');
        let formattedComment = lines[0].trim() + '\n';
        
        for (let i = 1; i < lines.length - 1; i++) {
            formattedComment += this.getIndentation() + ' * ' + lines[i].trim() + '\n';
        }

        formattedComment += this.getIndentation() + ' ' + lines[lines.length - 1].trim() + '\n';
        return formattedComment;
    }

	private wrapLines(code: string): string {
        if (this.config.maxLineLength <= 0) {
            return code;
        }

        const lines = code.split('\n');
        return lines.map(line => this.wrapLine(line)).join('\n');
    }

    private wrapLine(line: string): string {
        if (line.length <= this.config.maxLineLength) {
            return line;
        }

        // Implement line wrapping logic here
        // This is a simple implementation and might need to be improved
        const wrappedLines: string[] = [];
        let currentLine = '';

        for (const word of line.split(' ')) {
            if (currentLine.length + word.length + 1 > this.config.maxLineLength) {
                wrappedLines.push(currentLine.trim());
                currentLine = this.getIndentation() + word;
            } else {
                currentLine += (currentLine ? ' ' : '') + word;
            }
        }

        if (currentLine) {
            wrappedLines.push(currentLine.trim());
        }

        return wrappedLines.join('\n');
    }



	

    private needSpaceBetween(lastToken: Token | null, currentToken: Token | null): boolean {
        if (lastToken === null || currentToken === null) {
            return false;
        }

        // No space needed for these combinations
        const noSpaceCombinations: [Token, Token][] = [
            [Token.Dot, Token.Identifier],
            [Token.LeftParen, Token.RightParen],
            [Token.LeftSquare, Token.RightSquare],
            [Token.LeftCurly, Token.RightCurly],
            [Token.Identifier, Token.LeftParen],
            [Token.Identifier, Token.LeftSquare],
            [Token.Identifier, Token.Dot],
        ];

        for (const [first, second] of noSpaceCombinations) {
            if (lastToken === first && currentToken === second) {
                return false;
            }
        }

        // Space needed for most other combinations
        return true;
    }
}
/*
export function activate(context: vscode.ExtensionContext) {
    function getFormatterConfig(): FormatterConfig {
        const config = vscode.workspace.getConfiguration('leoFormatter');
        return {
            indentSize: config.get('indentSize', 4),
            useTabs: config.get('useTabs', false),
            maxLineLength: config.get('maxLineLength', 120),
            insertSpaceBeforeBrace: config.get('insertSpaceBeforeBrace', true),
            insertSpaceInParentheses: config.get('insertSpaceInParentheses', false),
        };
    }

    let disposable = vscode.languages.registerDocumentFormattingEditProvider('leo', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            const config = getFormatterConfig();
            const formatter = new LeoFormatter(config);
            const text = document.getText();
            const formatted = formatter.format(text);
            const range = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            return [vscode.TextEdit.replace(range, formatted)];
        }
    });

    context.subscriptions.push(disposable);
}
*/

export function activate(context: vscode.ExtensionContext) {
    // Register completion provider
    const completionProvider = new LeoCompletionItemProvider();
    const completionDisposable = vscode.languages.registerCompletionItemProvider('leo', completionProvider, '.');
    context.subscriptions.push(completionDisposable);

    // Register formatter
    const formatter = new LeoFormatter();
    const formatterDisposable = vscode.languages.registerDocumentFormattingEditProvider('leo', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            const text = document.getText();
            const formatted = formatter.format(text);
            const range = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            return [vscode.TextEdit.replace(range, formatted)];
        }
    });
    context.subscriptions.push(formatterDisposable);
}

export function deactivate() {}

