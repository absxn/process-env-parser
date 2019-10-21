"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var process_1 = require("process");
function toPrintable(variable) {
    var typeOf = typeof variable;
    if (["string", "number", "boolean"].includes(typeOf)) {
        return JSON.stringify(variable);
    }
    else if (variable === null) {
        return "null";
    }
    else if (variable === undefined) {
        return "undefined";
    }
    else {
        return typeOf;
    }
}
/**
 * Read environment variables using variable-specific configurations.
 *
 * @param configuration Object with keys matching the expected environment
 *                      variables, values describing the configuration how
 *                      that variable is handled
 *
 * @return Success object if all required variables were found and no given
 *         parser threw exceptions, otherwise returns Fail object.
 */
function parseEnvironmentVariables(configuration) {
    var variables = Object.keys(configuration);
    var result = {};
    var printableResult = {};
    var fail = false;
    for (var _i = 0, variables_1 = variables; _i < variables_1.length; _i++) {
        var variable = variables_1[_i];
        var value = process_1.env[variable];
        var config = configuration[variable];
        if (value !== undefined) {
            try {
                result[variable] = config.parser ? config.parser(value) : value;
                printableResult[variable] = config.mask
                    ? "<masked>"
                    : JSON.stringify(result[variable]);
            }
            catch (e) {
                printableResult[variable] = "<parser: \"" + e.message + "\">";
                fail = true;
            }
        }
        else {
            // If default has been set to falsy, e.g. null or explicit undefined, we
            // need to check for existence of property in runtime
            if (config.hasOwnProperty("default")) {
                result[variable] = config.default;
                printableResult[variable] = "" + (config.mask ? "<masked>" : toPrintable(result[variable]));
            }
            else {
                printableResult[variable] = "<missing>";
                fail = true;
            }
        }
    }
    if (fail) {
        return {
            success: false,
            envPrintable: printableResult
        };
    }
    else {
        return {
            success: true,
            env: result,
            envPrintable: printableResult
        };
    }
}
exports.parseEnvironmentVariables = parseEnvironmentVariables;
function createDefaultConfiguration() {
    var environmentVariables = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        environmentVariables[_i] = arguments[_i];
    }
    var result = {};
    for (var _a = 0, environmentVariables_1 = environmentVariables; _a < environmentVariables_1.length; _a++) {
        var environmentVariableName = environmentVariables_1[_a];
        var parser = {
            parser: function (value) { return value; }
        };
        result[environmentVariableName] = parser;
    }
    return result;
}
/**
 * Read given environment variables and return their values as strings.
 *
 * @param environmentVariables Names of the required environment variables
 *
 * @return Success object if all required variables were set, Fail object if
 *         any of them were missing
 */
function requireEnvironmentVariables() {
    var environmentVariables = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        environmentVariables[_i] = arguments[_i];
    }
    var configuration = createDefaultConfiguration.apply(void 0, environmentVariables);
    return parseEnvironmentVariables(configuration);
}
exports.requireEnvironmentVariables = requireEnvironmentVariables;
function oneliner(result) {
    return Object.entries(result.envPrintable)
        .map(function (_a) {
        var variableName = _a[0], printableValue = _a[1];
        return variableName + "=" + printableValue;
    })
        .join(", ");
}
/**
 * Helper to ensure that all values in a mapping are either set or not.
 *
 * @param environmentVariableMapping Mapping of {VARIABLE_NAME: any, ...}, i.e.
 *                                   the success result (.env) form the parser
 *                                   functions.
 *
 * @return If all values are non-nullable (not `null` and not `undefined`, as
 *         per TypeScript's NonNullable<T>), return input object as is. If all
 *         are nullable, return null. If there is a mix of nullable and non-
 *         nullable values, throws an error.
 */
function nonNullable(environmentVariableMapping) {
    // tslint:disable-next-line:no-let
    var truthy = false;
    var output = {};
    var truthyKeys = [];
    var falsyKeys = [];
    var keys = Object.keys(environmentVariableMapping);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var value = environmentVariableMapping[key];
        if (value !== undefined && value !== null) {
            truthy = true;
            truthyKeys.push(key);
            output[key] = value;
        }
        else if (truthy) {
            falsyKeys.push(key);
        }
    }
    if (truthyKeys.length > 0 && falsyKeys.length > 0) {
        throw new Error("Mix of non-nullable (" + truthyKeys.join(", ") + ") and nullable (" + falsyKeys.join(", ") + ") values");
    }
    return truthy ? output : null;
}
exports.Formatter = {
    oneliner: oneliner
};
exports.Combine = {
    nonNullable: nonNullable
};
//# sourceMappingURL=process-env-parser.js.map