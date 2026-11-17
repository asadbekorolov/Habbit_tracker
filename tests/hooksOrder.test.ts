// Ishga tushirish: npm test
// React #310 ("Rendered more hooks than during the previous render") oldini
// olish: har bir komponent/hook'da hook'lar shartsiz va har qanday `return`dan
// oldin chaqirilishi shart. TypeScript AST bilan butun src/ tekshiriladi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../src');

function listFiles(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) listFiles(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

const isHookCall = (n: ts.Node): n is ts.CallExpression =>
  ts.isCallExpression(n) &&
  ((ts.isIdentifier(n.expression) && /^use[A-Z]/.test(n.expression.text)) ||
    (ts.isPropertyAccessExpression(n.expression) &&
      /^use[A-Z]/.test(n.expression.name.text) &&
      n.expression.expression.getText() === 'React'));

const CONDITIONAL_OPS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function collectHooks(node: ts.Node, out: { node: ts.CallExpression; conditional: boolean }[], conditional: boolean) {
  if (ts.isFunctionLike(node)) return; // ichki funksiyalar alohida tekshiriladi
  if (isHookCall(node)) out.push({ node, conditional });
  const cond =
    ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isIterationStatement(node, false) ||
    ts.isSwitchStatement(node) || (ts.isBinaryExpression(node) && CONDITIONAL_OPS.has(node.operatorToken.kind));
  ts.forEachChild(node, (c) => collectHooks(c, out, conditional || cond));
}

function containsReturn(node: ts.Node): boolean {
  let found = false;
  (function visit(n: ts.Node) {
    if (found || (n !== node && ts.isFunctionLike(n))) return;
    if (ts.isReturnStatement(n)) { found = true; return; }
    ts.forEachChild(n, visit);
  })(node);
  return found;
}

function functionName(node: ts.Node): string | null {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
    return node.parent.name.text;
  }
  return null;
}

test("hook'lar shartsiz va early return'dan oldin chaqiriladi (React #310)", () => {
  const problems: string[] = [];
  for (const file of listFiles(ROOT)) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    (function visit(node: ts.Node) {
      const name = functionName(node);
      const body = (node as ts.FunctionLikeDeclaration).body;
      if (name && /^(use[A-Z]|[A-Z])/.test(name) && body && ts.isBlock(body)) {
        let returnedAt: number | null = null;
        for (const st of body.statements) {
          const hooks: { node: ts.CallExpression; conditional: boolean }[] = [];
          collectHooks(st, hooks, false);
          for (const h of hooks) {
            if (returnedAt !== null || h.conditional) {
              const line = sf.getLineAndCharacterOfPosition(h.node.getStart()).line + 1;
              problems.push(`${path.relative(ROOT, file)}:${line} ${name}: ${h.node.expression.getText()}` +
                (returnedAt !== null ? ` — ${returnedAt}-qatordagi return'dan keyin` : ' — shartli'));
            }
          }
          if (returnedAt === null && (ts.isReturnStatement(st) || (ts.isIfStatement(st) && containsReturn(st)))) {
            returnedAt = sf.getLineAndCharacterOfPosition(st.getStart()).line + 1;
          }
        }
      }
      ts.forEachChild(node, visit);
    })(sf);
  }
  assert.deepEqual(problems, [], 'Hook tartibi buzilgan:\n' + problems.join('\n'));
});
