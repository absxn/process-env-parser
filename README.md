# process-env-parser

Straightforward and type-safe environment variable validation, parsing, and
debugging for `node` applications.

```typescript
const result = parseEnvironmentVariables({
  API_KEY: { mask: true, default: null },
  DATABASE_URL: { parser: s => new URL(s).toString() },
  LISTEN_PORT: { parser: parseInt, default: 3000 },
  SERVICE_NAME: {}
});

if (result.success) {
  // Sample success output
  console.table(result.envPrintable);
  // ┌──────────────┬────────────────────────────────┐
  // │   (index)    │             Values             │
  // ├──────────────┼────────────────────────────────┤
  // │   API_KEY    │           '<masked>'           │
  // │ DATABASE_URL │ '"mysql://localhost:3306/app"' │
  // │ LISTEN_PORT  │             '8080'             │
  // │ SERVICE_NAME │            '"app"'             │
  // └──────────────┴────────────────────────────────┘

  // Inferred type for successfully parsed environment
  // {
  //   API_KEY: string | null
  //   DATABASE_URL: string
  //   LISTEN_PORT: number
  //   SERVICE_NAME: string
  // }
  return result.env;
} else {
  // Sample failure output
  console.table(result.envPrintable);
  // ┌──────────────┬──────────────────────────────────────┐
  // │   (index)    │                Values                │
  // ├──────────────┼──────────────────────────────────────┤
  // │   API_KEY    │             '<masked>'               │
  // │ DATABASE_URL │ '<parser: "Invalid URL: localhost">' │
  // │ LISTEN_PORT  │               '3000'                 │
  // │ SERVICE_NAME │             '<missing>'              │
  // └──────────────┴──────────────────────────────────────┘

  throw new Error("Could not parse environment variables");
}
```

- [Rationale](#rationale)
- [Installation and usage](#installation-and-usage)
- [Examples](#examples)
  - [Success: Simple usage with mandatory variables](#success-simple-usage-with-mandatory-variables)
  - [Success: Optional and parsed variables](#success-optional-and-parsed-variables)
  - [Fail: Variable missing](#fail-variable-missing)
  - [Fail: Parser throwing](#fail-parser-throwing)
- [Combine](#combine)
  - [Non-nullable](#non-nullable)
- [Formatter](#formatter)
  - [`console.table()`](#console-table)
  - [Oneliner](#oneliner)

## Rationale

At the start of every process there are two sources of inputs that can affect
the process execution: the program arguments, and the environment variables.

```sh
$ ENV_VAR_A=Hello ENV_VAR_B=World node app.js arg1 arg2 --arg3
```

In order to build reliable software, and minimize runtime surprises, you'll
want to follow the [fail-fast design](https://en.wikipedia.org/wiki/Fail-fast)
and _ensure that your program inputs are correct as early on as possible_.
Everything the program does afterwards is be based on these inputs.

For example, ensuring that a required database URL is correctly passed to the
process at the very beginning will alert the user clearly of a possible issue,
instead of the the app crashing 30 minutes later when the database connection
is done the first time.

This library tries to provide useful tooling for handling the environment
variable part of startup.

## Installation and usage

```sh
$ npm install --save @absxn/process-env-parser
```

```typescript
import {
  parseEnvironmentVariables,
  requireEnvironmentVariables
} from "@absxn/process-env-parser";
```

Both functions return the same `Success | Fail` object:

```typescript
// Types roughly as follows, read code and inline documentation for details

type Success = {
  success: true;
  env: {
    [variableName: string]:
      | InferredParserFunctionReturnType // If `parser` option used
      | InferredDefaultValueType // If `default` option used
      | string; // No options used
  };
  envPrintable: {
    // Human readable results for logging and debugging
    // E.g. `ENV_VAR_A=<missing>, ENV_VAR_B="World", PASSWORD=<masked>`
    [variableName: string]: string;
  };
};

type Fail = {
  success: false;
  // Same as for Success
  envPrintable: { [variableName: string]: string };
};
```

## Examples

### Success: Simple usage with mandatory variables

Easiest way to read the variables is to use
`requireEnvironmentVariables(...variableNames: string[])`. It reads given
variables, must find them all, and returns their values as strings.

To succeed, all listed variables must exist in the environment

#### Process startup

```sh
$ A=hello B=world node app
```

#### Code

```typescript
// Type: Success | Fail
const result = requireEnvironmentVariables("A", "B");

if (result.success) {
  console.table(result.envPrintable);
  // ┌─────────┬───────────┐
  // │ (index) │  Values   │
  // ├─────────┼───────────┤
  // │    A    │ '"hello"' │
  // │    B    │ '"world"' │
  // └─────────┴───────────┘

  // Type: { A: string, B: string }
  // Value: { A: "hello", B: "world" }
  return result.env;
} else {
  // Wont get here since we gave both A and B in the startup
}
```

### Success: Optional and parsed variables

If you have a more complex setup for the variables, you can use
`parseEnvironmentVariables(config: Config)`. This allows you to handle each
variable individually with additional functionality.

The `config` object has variable names as keys, and the value is an object
specifying how to handle that variable.

The available options are:

```typescript
interface Config {
  [variableName: string]: {
    // If variable is not found, use this as its value. If `default` not
    // given, variable is mandatory, in which case, a missing variable leads
    // to Fail being returned.
    default?: any;
    // When variable is read, its value is passed first to the parser
    // function. Return value of the parser is used as the variable value in
    // the output. If the parser throws, the function will return a Fail
    // object.
    parser?: (value: string) => any;
    // If `true`, the value of the variable is never shown in plain text in
    // the `envPrintable` fields of the return object. Value is indicated as
    // `<masked>`.
    mask?: boolean;
  };
}
```

To succeed:

- All varibales with no `default` given must exist in the environment
  - Empty string `""` is considered as non-existing!
- No `parser` may throw
  - Parser exceptions turn result into `Fail` and the exception message is
    captured in the `envPrintable` fields. See examples below.

Default value is used as is, also when parser is given, i.e. default value is
not passed to parser when used.

#### Process startup

```sh
$ REQUIRED=value PARSED=12345 node app
```

#### Code

```typescript
// Ensure we return only valid numbers
function parser(s: string): number {
  const p = parseInt(s);

  if (isNaN(p)) {
    throw new Error("Not a number");
  } else {
    return p;
  }
}

const result = parseEnvironmentVariables({
  REQUIRED: {},
  PARSED: { parser },
  OPTIONAL: { default: "OPTIONAL" }
});

if (result.success) {
  console.table(result.envPrintable);
  // ┌──────────┬──────────────┐
  // │ (index)  │    Values    │
  // ├──────────┼──────────────┤
  // │ REQUIRED │  '"value"'   │
  // │  PARSED  │    '1234'    │
  // │ OPTIONAL │ '"OPTIONAL"' │
  // └──────────┴──────────────┘

  // Type: { REQUIRED: string, PARSER: number, OPTIONAL: "OPTIONAL" | string }
  // Value: { REQUIRED: "value", PARSED: 1234, OPTIONAL: "OPTIONAL" }
  return result.env;
} else {
  // Will not get here
}
```

### Fail: Variable missing

#### Process startup

```sh
$ VAR_A=value VAR_B= VAR_C="${X} ${Y} ${Z}" node app
```

WARNING – Special cases for "meaningless" strings:
- Empty string: `VAR_B` is also considered as missing. I.e. `process.env.VAR_B`
  does exist, but the parser considers `""` equal to not set.
- Blank string: `VAR_C` is also considered not set. In this case, `X`, `Y`, `Z`
  are all `""`, so the resulting value of `VAR_C` is two spaces,
  `"  "`. If value is surrounded by spaces, e.g. `" A "`, the spaces are
  preserved as is through the parser.

#### Code

```typescript
const result = requireEnvironmentVariables("VAR_A", "VAR_B", "VAR_C", "VAR_D");

if (result.success) {
  // Won't get there
} else {
  console.table(result.envPrintable);
  //  ┌─────────┬─────────────┐
  //  │ (index) │   Values    │
  //  ├─────────┼─────────────┤
  //  │  VAR_A  │  '"value"'  │
  //  │  VAR_B  │ '<missing>' │
  //  │  VAR_C  │ '<missing>' │
  //  │  VAR_D  │ '<missing>' │
  //  └─────────┴─────────────┘
}
```

### Fail: Parser throwing

#### Process startup

```sh
$ NOT_ACTUAL_NUMBER=xyz node app
```

#### Code

```typescript
function parser(s: string): number {
  const p = parseInt(s);

  if (isNaN(p)) {
    throw new Error("Not a number");
  } else {
    return p;
  }
}

const result = parseEnvironmentVariables({
  NOT_ACTUAL_NUMBER: { parser }
});

if (result.success) {
  // Won't get there
} else {
  console.table(result.envPrintable);
  // ┌───────────────────┬────────────────────────────┐
  // │      (index)      │           Values           │
  // ├───────────────────┼────────────────────────────┤
  // │ NOT_ACTUAL_NUMBER │ '<parser: "Not a number">' │
  // └───────────────────┴────────────────────────────┘
}
```

## Combine

Helpers for manipulating parser results.

```typescript
import { Combine } from "@absxn/process-env-parser";
```

### Non-nullable

If you have a subset of environment variables that depend on each other, i.e.
you either need all of them, or none of them, this function helps to ensure
that.

"Nullable" is here defined by TypeScript's `NonNullable<T>`, that is, `null` or
`undefined`.

Lets assume we have this setup:

```typescript
function getConfig() {
  // For parsing purposes, both USERNAME and PASSWORD are optional...
  const result = parseEnvironmentVariables({
    DATABASE: {},
    USERNAME: { default: null },
    PASSWORD: { default: null }
  });

  if (!result.success) {
    return null;
  }

  const { DATABASE, USERNAME, PASSWORD } = result.env;

  return {
    // ... but for actual authentication, you need both
    auth: Combine.nonNullable({ USERNAME, PASSWORD }),
    db: DATABASE
  };
}
```

We would get the following results with given startup parameters:

```
$ DATABASE=db USERNAME=user PASSWORD=pass node app
getConfig() -> { auth: { USERNAME: "user", PASSWORD: "pass" }, db: "db" }

$ DATABASE=db node app
getConfig() -> { auth: null, db: "db" }

$ DATABASE=db USERNAME=user node app
getConfig() -> new Error("Mix of non-nullable (USERNAME) and nullable (PASSWORD) values")

$ node app
getConfig() -> null
```

If the object is returned, the return type has nullability removed from each
value:

```typescript
// Type before: { a: string | null, b: number | undefined }
const nullableValues = {
  a: Math.random() > 0.5 ? "X" : null,
  b: Math.random() > 0.5 ? 1 : undefined
};
// Type after: {a: string, b: number} | null
const nonNullableValues = Combine.nonNullable(nullableTypes);
```

## Formatter

The library contains additional helper functions for printing out the parser
results. These can be useful for storing the startup configuration into logs
or printing out startup failure reasons.

Importing `Formatter` from the package:

```typescript
import { Formatter } from "@absxn/process-env-parser";
```

### `console.table()`

As a built-in, `console.table()` is the easiest way to get a readable dump from
the parser results.

```typescript
const result = requireEnvironmentVariables("VARIABLE"/*, ...*/);

console.table(result.envPrintable);
// ┌──────────┬─────────┐
// │ (index)  │ Values  │
// ├──────────┼─────────┤
// │ VARIABLE │ 'value' │
// │   ...    │   ...   │
// └──────────┴─────────┘
```

### Oneliner

Using the data from the first example:

```typescript
const result = parseEnvironmentVariables({
  API_KEY: { mask: true, default: null },
  DATABASE_URL: { parser: s => new URL(s).toString() },
  LISTEN_PORT: { parser: parseInt, default: 3000 },
  SERVICE_NAME: {}
});

console.log(Formatter.oneliner(result));
// if (result.success === true):
// > API_KEY=<masked>, DATABASE_URL="mysql://localhost:3306/app", LISTEN_PORT=8080, SERVICE_NAME="app"
// else:
// > API_KEY=<masked>, DATABASE_URL=<parser: "Invalid URL: localhost">, LISTEN_PORT=3000, SERVICE_NAME=<missing>
```
