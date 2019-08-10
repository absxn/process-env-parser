declare type ParserFunction<ParserReturnType> = (environmentVariableValue: string) => ParserReturnType;
declare type ParserOption<ParserReturnType> = {
    parser: ParserFunction<ParserReturnType>;
};
declare type ParserOptionDefault = {
    parser?: ParserFunction<string>;
};
declare type DefaultValueType<Options, ParserReturnType> = Options extends {
    default: any;
} ? Options extends {
    default: infer DefaultType;
} ? DefaultType | ParserReturnType : ParserReturnType : ParserReturnType;
declare type EnvironmentVariables<Configuration extends EnvironmentVariableOptions> = {
    [EnvironmentVariableName in keyof Configuration]: DefaultValueType<Configuration[EnvironmentVariableName], Configuration[EnvironmentVariableName] extends ParserOption<any> ? ReturnType<Configuration[EnvironmentVariableName]["parser"]> : string>;
};
declare type EnvironmentVariablesPrintable<Configuration extends EnvironmentVariableOptions> = {
    [EnvironmentVariableName in keyof Configuration]: string;
};
declare type EnvironmentVariableOptions = {
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
interface Success<Configuration extends EnvironmentVariableOptions> extends Status<Configuration> {
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
interface Fail<Configuration extends EnvironmentVariableOptions> extends Status<Configuration> {
    readonly success: false;
}
declare type Result<Configuration extends EnvironmentVariableOptions> = Success<Configuration> | Fail<Configuration>;
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
export declare function parseEnvironmentVariables<Configuration extends EnvironmentVariableOptions>(configuration: Configuration): Result<Configuration>;
/**
 * Read given environment variables and return their values as strings.
 *
 * @param environmentVariables Names of the required environment variables
 *
 * @return Success object if all required variables were set, Fail object if
 *         any of them were missing
 */
export declare function requireEnvironmentVariables<EnvironmentVariableName extends string>(...environmentVariables: EnvironmentVariableName[]): Result<{ [key in EnvironmentVariableName]: ParserOption<string>; }>;
declare function oneliner<Configuration extends EnvironmentVariableOptions>(result: Pick<Result<Configuration>, "envPrintable">): string;
export declare const Formatter: {
    oneliner: typeof oneliner;
};
export {};
