import { env } from "process";

type Default = { default: any };
type NoDefault = { default?: any };
type MaybeMask = { mask?: boolean };
type MaybeDefault = Default | NoDefault;
type ParserFn<P> = (x: string) => P;
type Parser<P> = { parser: ParserFn<P> };
type NoParser = { parser?: ParserFn<string> };
type MaybeParser<P> = Parser<P> | NoParser;
type ReadEnvConfig = MaybeParser<any> & MaybeDefault & MaybeMask;
type CheckOptional<T, R> = T extends { default: any }
  ? T extends { default: infer D }
    ? D | R
    : R
  : R;
type Result<T extends Mapping> = {
  [k in keyof T]: CheckOptional<
    T[k],
    T[k] extends Parser<any> ? ReturnType<T[k]["parser"]> : string
  >;
};
type Mapping = {
  [key: string]: ReadEnvConfig;
};

/**
 * If all required variables were found and parsed correctly, this object is
 * returned.
 */
type Success<T extends Mapping> = {
  /**
   * Use this field to check whether to handle Success or Fail type
   */
  success: true;
  /**
   * Usage string, showing the parsed variables and their values (unless masked)
   */
  message: string;
  /**
   * Object with keys representing the environment variable names, and values
   * representing either the variable values as strings, or as the return value
   * of their respective parser function.
   */
  env: Result<T>;
};

/**
 * If any required variable was missing, or any parser threw an exception, this
 * object is returned.
 */
type Fail = {
  /**
   * Use this field to check whether to handle Success or Fail type
   */
  success: false;
  /**
   * Usage string, showing the parsed variables and their values (unless masked)
   */
  message: string;
};

type ParserResult<T extends Mapping> = Success<T> | Fail;

const variableToString = (variable: any): string => {
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
};

/**
 * Read environment variables using variable-specific configurations.
 *
 * @param variableConfigs Object with keys matching the expected environment
 *                        variables, values describing the configuration how
 *                        that variable is handled
 *
 * @return Success object if all required variables were found and no given
 *         parser threw exceptions, otherwise returns Fail object.
 */
export const parseEnvironmentVariables = <T extends Mapping>(
  variableConfigs: T
): ParserResult<T> => {
  const variables = Object.keys(variableConfigs) as (keyof T)[];
  const result = {} as Result<T>;
  const texts = [] as [(keyof T), boolean, string][];
  for (const variable of variables) {
    const value = env[variable as string];
    const config = variableConfigs[variable];
    if (value !== undefined) {
      try {
        result[variable] = config.parser ? config.parser(value) : value;
        texts.push([
          variable,
          true,
          `${config.mask ? "<masked>" : JSON.stringify(result[variable])}`
        ]);
      } catch (e) {
        texts.push([variable, false, `<parser: "${e.message}">`]);
      }
    } else {
      // If default has been set to falsy, e.g. null or explicit undefined, we
      // need to check for existence of property in runtime
      if ((config as {}).hasOwnProperty("default")) {
        result[variable] = config.default;
        texts.push([
          variable,
          true,
          `${config.mask ? "<masked>" : variableToString(result[variable])}`
        ]);
      } else {
        texts.push([variable, false, "<missing>"]);
      }
    }
  }

  const message = `${[...texts.sort(([aKey], [bKey]) => (aKey > bKey ? 1 : 0))]
    .map(([key, _isOk, text]) => `${key}=${text}`)
    .join(", ")}`;

  if (texts.find(([_, isOk]) => !isOk) !== undefined) {
    return {
      success: false,
      message
    };
  } else {
    return {
      success: true,
      message,
      env: result
    };
  }
};

const mkConf = <
  T extends { [key: string]: { parser: P } },
  K extends keyof T,
  P extends ParserFn<R>,
  R extends string
>(
  ...variables: (K)[]
): { [Key in K]: { parser: P } } => {
  const parser = ((value: string): string => value) as P;
  const result = {} as { [Key in K]: { parser: P } };
  for (const v of variables) {
    result[v] = { parser };
  }
  return result;
};

/**
 * Read given environment variables and return their values as strings.
 *
 * @param keys Names of the required environment variables
 *
 * @return Success object if all required variables were set, Fail object if
 *         any of them were missing
 */
export const requireEnvironmentVariables = <
  T extends { [key: string]: { parser: P } },
  K extends string,
  P extends ParserFn<R>,
  R extends string
>(
  ...keys: (K)[]
) => {
  const confs = mkConf<T, K, P, R>(...keys);

  return parseEnvironmentVariables(confs);
};
