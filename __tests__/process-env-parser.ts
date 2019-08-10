import {
  Formatter,
  parseEnvironmentVariables,
  requireEnvironmentVariables
} from "../process-env-parser";

describe("Environment variable parser", () => {
  it("returns a successful result", () => {
    process.env.A = "A";
    const result = parseEnvironmentVariables({ A: {} });
    expect(result).toEqual({
      success: true,
      env: { A: "A" },
      envPrintable: { A: `"A"` }
    });
  });

  it("returns missing variables", () => {
    process.env.A = "A";
    const result = parseEnvironmentVariables({
      MISSING: {},
      MISSING_TOO: {},
      A: {}
    });
    expect(result).toEqual({
      success: false,
      envPrintable: {
        A: `"A"`,
        MISSING: "<missing>",
        MISSING_TOO: "<missing>"
      }
    });
  });

  it("can use custom parser function", () => {
    process.env.A = "1234";
    const result = parseEnvironmentVariables({ A: { parser: parseInt } });
    expect(result).toEqual({
      success: true,
      env: { A: 1234 },
      envPrintable: { A: "1234" }
    });
  });

  it("returns default value for missing optional variables", () => {
    process.env.A = "A";
    const result = parseEnvironmentVariables({
      A: {},
      OPTIONAL: { default: "OPTIONAL" }
    });
    expect(result).toEqual({
      success: true,
      env: { A: "A", OPTIONAL: "OPTIONAL" },
      envPrintable: { A: `"A"`, OPTIONAL: `"OPTIONAL"` }
    });
  });

  it("accepts default and parser", () => {
    process.env.PARSED_OPTIONAL = "1234";
    const result = parseEnvironmentVariables({
      PARSED_OPTIONAL: { parser: parseInt, default: 123 }
    });
    expect(result).toEqual({
      success: true,
      env: { PARSED_OPTIONAL: 1234 },
      envPrintable: { PARSED_OPTIONAL: "1234" }
    });
  });

  it("uses default value when variable missing", () => {
    const result = parseEnvironmentVariables({
      PARSED_OPTIONAL_MISSING: { parser: parseInt, default: 4321 }
    });
    expect(result).toEqual({
      success: true,
      env: { PARSED_OPTIONAL_MISSING: 4321 },
      envPrintable: { PARSED_OPTIONAL_MISSING: "4321" }
    });
  });

  it("masks found variables", () => {
    process.env.MASK = "secret";
    const result = parseEnvironmentVariables({
      MASK: { mask: true }
    });
    expect(result).toEqual({
      success: true,
      env: { MASK: "secret" },
      envPrintable: { MASK: "<masked>" }
    });
  });

  it("masks found parsed variables", () => {
    process.env.MASK = "1234";
    const result = parseEnvironmentVariables({
      MASK: { mask: true, parser: parseInt }
    });
    expect(result).toEqual({
      success: true,
      env: { MASK: 1234 },
      envPrintable: { MASK: "<masked>" }
    });
  });

  it("shows parser errors even when masked", () => {
    process.env.MASK = "1234";
    const result = parseEnvironmentVariables({
      MASK: {
        mask: true,
        parser: () => {
          throw new Error("ERROR");
        }
      }
    });
    expect(result).toEqual({
      success: false,
      envPrintable: { MASK: `<parser: "ERROR">` }
    });
  });

  it("masks default variables", () => {
    const result = parseEnvironmentVariables({
      MASKED_DEFAULT: { mask: true, default: "secret" }
    });
    expect(result).toEqual({
      success: true,
      env: { MASKED_DEFAULT: "secret" },
      envPrintable: { MASKED_DEFAULT: "<masked>" }
    });
  });

  it("allows default to be of different type than parser if using both", () => {
    const result = parseEnvironmentVariables({
      PARSED_OPTIONAL_MISSING: { parser: parseInt, default: "STRING" }
    });
    expect(result).toEqual({
      success: true,
      env: { PARSED_OPTIONAL_MISSING: "STRING" },
      envPrintable: { PARSED_OPTIONAL_MISSING: `"STRING"` }
    });
  });

  it("catches parser exceptions", () => {
    process.env.A = "A";
    const result = parseEnvironmentVariables({
      A: {
        parser: () => {
          throw new Error("ERROR");
        }
      }
    });
    expect(result).toEqual({
      success: false,
      envPrintable: { A: `<parser: "ERROR">` }
    });
  });

  it("handles boolean value in message", () => {
    const result = parseEnvironmentVariables({
      V: {
        default: true
      }
    });
    expect(result).toEqual({
      success: true,
      env: { V: true },
      envPrintable: { V: "true" }
    });
  });

  it("handles null in message", () => {
    const result = parseEnvironmentVariables({
      V: {
        default: null
      }
    });
    expect(result).toEqual({
      success: true,
      env: { V: null },
      envPrintable: { V: "null" }
    });
  });

  it("handles undefined in message", () => {
    const result = parseEnvironmentVariables({
      V: {
        default: undefined
      }
    });
    expect(result).toEqual({
      success: true,
      env: { V: undefined },
      envPrintable: { V: "undefined" }
    });
  });

  it("handles object in message", () => {
    const result = parseEnvironmentVariables({
      V: {
        default: { key: "value" }
      }
    });
    expect(result).toEqual({
      success: true,
      env: { V: { key: "value" } },
      envPrintable: { V: "object" }
    });
  });

  it("handles function in message", () => {
    const func = () => "value";
    const result = parseEnvironmentVariables({
      V: {
        default: func
      }
    });
    expect(result).toEqual({
      success: true,
      env: { V: func },
      envPrintable: { V: "function" }
    });
  });
});

describe("Simple environment variable parser", () => {
  it("parses existing value as string", () => {
    process.env.A = "A";
    const result = requireEnvironmentVariables("A");
    expect(result).toEqual({
      success: true,
      env: { A: "A" },
      envPrintable: { A: `"A"` }
    });
  });

  it("catches missing variables", () => {
    process.env.A = "A";
    const result = requireEnvironmentVariables("A", "MISSING");
    expect(result).toEqual({
      success: false,
      envPrintable: { A: `"A"`, MISSING: "<missing>" }
    });
  });
});

describe("Formatter", () => {
  it("supports turning result into a one-liner", () => {
    expect(
      Formatter.oneliner({
        envPrintable: {
          A: "value",
          B: "1234"
        }
      })
    ).toEqual("A=value, B=1234");
  });
});

// Following tests don't do anything in run-time, but they will break in
// compile-time if type inference breaks and types wont match.
const parser = (_num: string) => 1234;

const typeTest1 = parseEnvironmentVariables({
  STRING: {},
  REQUIRED: { parser },
  OPTIONAL: { parser, default: null }
});

if (typeTest1.success) {
  const { env } = typeTest1;
  const s: string = env.STRING; // string
  const n: number = env.REQUIRED; // 1234
  const nullableN: number | null = env.OPTIONAL; // null | 1234
  s;
  n;
  nullableN;
}

const typeTest2 = requireEnvironmentVariables("a", "b");

if (typeTest2.success) {
  const { env } = typeTest2;
  const s1: string = env.a; // string
  const s2: string = env.b; // string
  s1;
  s2;
}
