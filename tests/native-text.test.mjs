import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';

function rawText(source) {
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const ast = ts.createSourceFile('screen.js', output, ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(node) {
    if (ts.isCallExpression(node) && /^_jsxs?$/.test(node.expression.getText(ast)) && node.arguments[0]?.getText(ast) !== 'Text') {
      const props = node.arguments[1];
      if (props && ts.isObjectLiteralExpression(props)) {
        for (const prop of props.properties) {
          if (!ts.isPropertyAssignment(prop) || prop.name.getText(ast) !== 'children') continue;
          const children = ts.isArrayLiteralExpression(prop.initializer) ? prop.initializer.elements : [prop.initializer];
          for (const child of children) if (ts.isStringLiteral(child) || ts.isNumericLiteral(child)) found.push(child.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
test('Native text check catches significant inline whitespace between views', () => {
  assert.deepEqual(rawText('<View><View />      <View /></View>'), ['      ']);
  assert.deepEqual(rawText('<View>Bonjour</View>'), ['Bonjour']);
  assert.deepEqual(rawText('<View>\n  <Text>Bonjour</Text>\n</View>'), []);
});
test('Screens never render literal text or inline whitespace outside Text', () => {
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) inspect(path);
      else if (path.endsWith('.tsx')) {
        const source = readFileSync(path, 'utf8');
        assert.deepEqual(rawText(source), [], path);
        const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        for (const statement of ast.statements) {
          if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react-native') continue;
          const bindings = statement.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings)) {
            assert.ok(!bindings.elements.some(item => (item.propertyName ?? item.name).text === 'SafeAreaView'), `${path}: deprecated SafeAreaView import`);
          }
        }
      }
    }
  }
  inspect('src');
});
