import { env } from "process";

type ParserFunction<ParserReturnType> = (
  environmentVariableValue: string
) => ParserReturnType;

type ParserOption<ParserReturnType> = {
  parser: ParserFunction<ParserReturnType>;
};

type ParserOptionDefault = { parser?: ParserFunction<string> };

type DefaultValueType<Options, ParserReturnType> = Options extends {
  default: any;
}
  ? Options extends { default: infer DefaultType }
    ? DefaultType | ParserReturnType
    : ParserReturnType
  : ParserReturnType;

type EnvironmentVariables<Configuration extends EnvironmentVariableOptions> = {
  [EnvironmentVariableName in keyof Configuration]: DefaultValueType<
    Configuration[EnvironmentVariableName],
    Configuration[EnvironmentVariableName] extends ParserOption<any>
      ? ReturnType<Configuration[EnvironmentVariableName]["parser"]>
      : string
  >;
};

type EnvironmentVariablesPrintable<
  Configuration extends EnvironmentVariableOptions
> = {
  [EnvironmentVariableName in keyof Configuration]: string;
};

type EnvironmentVariableOptions = {
  [key: string]: (ParserOption<any> | ParserOptionDefault) & {
    default?: any;
    mask?: boolean;
  };
};

interface Status<Configuration extends EnvironmentVariableOptions> {
  /**
   * Use this field to check whether to handle Success or Fail type
   */
  readonly success: boolean;
  /**
   * Same mapping as env, but all values are strings and contain
   * human-readable, loggable, values for parser exceptions, missing values,
   * and actual values.
   */
  readonly envPrintable: Readonly<EnvironmentVariablesPrintable<Configuration>>;
}

/**
 * If all required variables were found and parsed correctly, this object is
 * returned.
 */
interface Success<Configuration extends EnvironmentVariableOptions>
  extends Status<Configuration> {
  readonly success: true;
  /**
   * Object with keys representing the environment variable names, and values
   * representing either the variable values as strings, or as the return value
   * of their respective parser function.
   */
  readonly env: Readonly<EnvironmentVariables<Configuration>>;
}

/**
 * If any required variable was missing, or any parser threw an exception, this
 * object is returned.
 */
interface Fail<Configuration extends EnvironmentVariableOptions>
  extends Status<Configuration> {
  readonly success: false;
}

type Result<Configuration extends EnvironmentVariableOptions> =
  | Success<Configuration>
  | Fail<Configuration>;

function toPrintable(variable: any): string {
  const typeOf = typeof variable;
  if (["string", "number", "boolean"].includes(typeOf)) {
    return JSON.stringify(variable);
  } else if (variable === null) {
    return "null";
  } else if (variable === undefined) {
    return "undefined";
  } else {
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
export function parseEnvironmentVariables<
  Configuration extends EnvironmentVariableOptions
>(configuration: Configuration): Result<Configuration> {
  const variables = Object.keys(configuration) as (keyof Configuration)[];
  const result = {} as EnvironmentVariables<Configuration>;
  const printableResult = {} as EnvironmentVariablesPrintable<Configuration>;
  let fail = false;

  for (const variable of variables) {
    const value = env[variable as string];
    const config = configuration[variable];
    if (value !== undefined && value.trim() !== "") {
      try {
        result[variable] = config.parser ? config.parser(value) : value;
        printableResult[variable] = config.mask
          ? "<masked>"
          : JSON.stringify(result[variable]);
      } catch (e) {
        printableResult[variable] = `<parser: "${e.message}">`;
        fail = true;
      }
    } else {
      // If default has been set to falsy, e.g. null or explicit undefined, we
      // need to check for existence of property in runtime
      if ((config as {}).hasOwnProperty("default")) {
        result[variable] = config.default;
        printableResult[variable] = `${
          config.mask ? "<masked>" : toPrintable(result[variable])
        } (default)`;
      } else {
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
  } else {
    return {
      success: true,
      env: result,
      envPrintable: printableResult
    };
  }
}

function createDefaultConfiguration<EnvironmentVariableName extends string>(
  ...environmentVariables: EnvironmentVariableName[]
) {
  const result = {} as {
    [key in EnvironmentVariableName]: ParserOption<string>;
  };
  for (const environmentVariableName of environmentVariables) {
    const parser: ParserOption<string> = {
      parser: (value: string): string => value
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
export function requireEnvironmentVariables<
  EnvironmentVariableName extends string
>(...environmentVariables: EnvironmentVariableName[]) {
  const configuration = createDefaultConfiguration<EnvironmentVariableName>(
    ...environmentVariables
  );

  return parseEnvironmentVariables(configuration);
}

function oneliner<Configuration extends EnvironmentVariableOptions>(
  result: Pick<Result<Configuration>, "envPrintable">
): string {
  return Object.entries(result.envPrintable)
    .map(
      ([variableName, printableValue]) => `${variableName}=${printableValue}`
    )
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
function nonNullable<T extends { [k in Key]: T[k] }, Key extends keyof T>(
  environmentVariableMapping: T
): { [k in Key]: NonNullable<T[k]> } | null {
  // tslint:disable-next-line:no-let
  let truthy = false;
  const output = {} as { [k in Key]: NonNullable<T[k]> };
  const truthyKeys = [];
  const falsyKeys = [];
  const keys = Object.keys(environmentVariableMapping) as Key[];
  for (const key of keys) {
    const value = environmentVariableMapping[key];
    if (value !== undefined && value !== null) {
      truthy = true;
      truthyKeys.push(key);
      output[key] = value as NonNullable<typeof value>;
    } else if (truthy) {
      falsyKeys.push(key);
    }
  }
  if (truthyKeys.length > 0 && falsyKeys.length > 0) {
    throw new Error(
      `Mix of non-nullable (${truthyKeys.join(
        ", "
      )}) and nullable (${falsyKeys.join(", ")}) values`
    );
  }
  return truthy ? output : null;
}

export const Formatter = {
  oneliner
};

export const Combine = {
  nonNullable
};
