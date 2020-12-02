const types = require("@babel/types");
let id = 1;
module.exports = function ({ types: babelTypes }) {
  return {
    name: "babel-preset-que-babel",
    visitor: {
      CallExpression(data, option) {
        const { node } = data;
        const { callee } = node;
        const { arguments } = node;
        const [, prop] = arguments;
        if (
          callee &&
          callee.object &&
          callee.object.name === "React" &&
          callee.property.name === "createElement"
        ) {
          if (arguments[0].type === "NumericLiteral") {
            return;
          }
          if (prop) {
            if (prop.type === "ObjectExpression") {
              // (prop.properties || []).
              arguments[1] = types.arrayExpression(
                (prop.properties || []).map((property) =>
                  types.objectExpression([
                    types.objectProperty(
                      types.stringLiteral("type"),
                      types.stringLiteral("normal")
                    ),
                    types.objectProperty(
                      types.stringLiteral("property"),
                      types.stringLiteral(property.key.name)
                    ),
                    types.objectProperty(
                      types.stringLiteral("value"),
                      types.arrowFunctionExpression([], property.value, false)
                    ),
                  ])
                )
              );
            } else if (prop.type === "CallExpression") {
              // 会变成Object.assign
              arguments[1] = types.arrayExpression(
                prop.arguments.reduce((lastV, p) => {
                  if (p.type === "ObjectExpression") {
                    (p.properties || []).forEach((property) =>
                      lastV.push(
                        types.objectExpression([
                          types.objectProperty(
                            types.stringLiteral("type"),
                            types.stringLiteral("normal")
                          ),
                          types.objectProperty(
                            types.stringLiteral("property"),
                            types.stringLiteral(property.key.name)
                          ),
                          types.objectProperty(
                            types.stringLiteral("value"),
                            types.arrowFunctionExpression(
                              [],
                              property.value,
                              false
                            )
                          ),
                        ])
                      )
                    );
                  } else if (p.type === "MemberExpression") {
                    lastV.push(
                      types.objectExpression([
                        types.objectProperty(
                          types.stringLiteral("type"),
                          types.stringLiteral("rest")
                        ),
                        types.objectProperty(
                          types.stringLiteral("value"),
                          types.arrowFunctionExpression([], p, false)
                        ),
                      ])
                    );
                  }
                  return lastV;
                }, [])
              );
            }
          }
          for (let i = 2; i < arguments.length; i++) {
            arguments[i] = types.arrowFunctionExpression(
              [],
              arguments[i],
              false
            );
          }

          arguments.unshift(types.numericLiteral(id++));
        }
      },
    },
  };
};
