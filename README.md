# process-env-parser

Straightforward and type-safe environment variable validation, parsing, and
debugging for `node` applications.

- [Rationale](#rationale)
- [Installation and usage](#installation-and-usage)
- [Examples](#examples)
  - [Success: Simple usage with mandatory variables](#success-simple-usage-with-mandatory-variables)
  - [Success: Optional and parsed variables](#success-optional-and-parsed-variables)
  - [Fail: Variable missing](#fail-variable-missing)
  - [Fail: Parser throwing](#fail-parser-throwing)

## Rationale

At the start of every process there are two sources of inputs that can affect
the process execution: the program arguments, and the environment variables.

```sh
$ ENV_VAR_A=Hello ENV_VAR_B=World node app.js arg1 arg2 --arg3
```

In order to build reliable software, and minimize runtime surprises, you'll
want to follow the [fail-fast design](https://en.wikipedia.org/wiki/Fail-fast)
and *ensure that your program inputs are correct as early on as possible*.
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
  message: string; // Human readable results for logging and debugging
                   // E.g. `ENV_VAR_A=<missing>, ENV_VAR_B="World", PASSWORD=<masked>`
  env: {
    [variableName: string]:
      | InferredParserFunctionReturnType // If `parser` option used
      | InferredDefaultValueType // If `default` option used
      | string; // No options used
  };
};

type Fail = {
  success: false;
  message: string; // Same as for Success
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
// Type: Success<T> | Fail
const result = requireEnvironmentVariables("A", "B");

if (result.success) {
  // Message: `A="hello", B="world"`
  console.log(result.message);

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
    // the `message` field of the return object. Value is indicated as
    // `<masked>`.
    mask?: boolean;
  };
}
```

To succeed:

- All varibales with no `default` given must exist in the environment
- No `parser` may throw
  - Parser exceptions turn result into `Fail` and the exception message is
    captured in the `message` field. See examples below.

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
  // Message: `OPTIONAL="OPTIONAL", PARSED=1234, REQUIRED="value"`
  console.log(result.message);

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
$ VAR_A=value node app
```

#### Code

```typescript
const result = requireEnvironmentVariables("VAR_A", "VAR_B");

if (result.success) {
  // Won't get there
} else {
  // Message: `VAR_A="value", VAR_B=<missing>`
  console.error(result.message);
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
  // Message: 'NOT_ACTUAL_NUMBER=<parser: "Not a number">'
  console.error(result.message);
}
```
