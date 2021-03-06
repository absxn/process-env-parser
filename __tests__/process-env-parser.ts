import {
  Combine,
  Formatter,
  Mask,
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
    process.env.EMPTY_STRING = "";
    const result = parseEnvironmentVariables({
      MISSING: {},
      MISSING_TOO: {},
      EMPTY_STRING: {}
    });
    expect(result).toEqual({
      success: false,
      envPrintable: {
        EMPTY_STRING: "<missing>",
        MISSING: "<missing>",
        MISSING_TOO: "<missing>"
      }
    });
  });

  it("handles pure whitespace string as not set", () => {
    process.env.BLANK = "   ";
    const result = parseEnvironmentVariables({
      BLANK: {}
    });
    expect(result).toEqual({
      success: false,
      envPrintable: {
        BLANK: "<missing>"
      }
    });
  });

  it("leaves surrounding whitespace intact", () => {
    process.env.TRIMMABLE = " A ";
    const result = parseEnvironmentVariables({
      TRIMMABLE: {}
    });
    expect(result).toEqual({
      success: true,
      env: { TRIMMABLE: " A " },
      envPrintable: { TRIMMABLE: `" A "` }
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
    process.env.EMPTY_STRING = "";
    const result = parseEnvironmentVariables({
      EMPTY_STRING: { default: "EMPTY_STRING" },
      OPTIONAL: { default: "OPTIONAL" }
    });
    expect(result).toEqual({
      success: true,
      env: { EMPTY_STRING: "EMPTY_STRING", OPTIONAL: "OPTIONAL" },
      envPrintable: {
        EMPTY_STRING: `"EMPTY_STRING" (default)`,
        OPTIONAL: `"OPTIONAL" (default)`
      }
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
      envPrintable: { PARSED_OPTIONAL_MISSING: "4321 (default)" }
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

  it("masks using a masking function that utilizes parser output", () => {
    process.env.MASK_FN = "user:pass";
    const result = parseEnvironmentVariables({
      MASK_FN: {
        mask: credentials => `${credentials.user}:*****`,
        parser: (s: string) => {
          const [user, pass] = s.split(":");
          return { user, pass };
        }
      }
    });
    expect(result).toEqual({
      success: true,
      env: { MASK_FN: { user: "user", pass: "pass" } },
      envPrintable: { MASK_FN: `<masked: "user:*****">` }
    });
  });

  it("masks using a masking function catches exceptions", () => {
    process.env.MASK_FN = "user:pass";
    const result = parseEnvironmentVariables({
      MASK_FN: {
        mask: _ => {
          throw new Error("ERROR");
        }
      }
    });
    expect(result).toEqual({
      success: false,
      envPrintable: { MASK_FN: `<mask: "ERROR">` }
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
      envPrintable: { MASKED_DEFAULT: "<masked> (default)" }
    });
  });

  it("allows default to be of different type than parser if using both", () => {
    const result = parseEnvironmentVariables({
      PARSED_OPTIONAL_MISSING: { parser: parseInt, default: "STRING" }
    });
    expect(result).toEqual({
      success: true,
      env: { PARSED_OPTIONAL_MISSING: "STRING" },
      envPrintable: { PARSED_OPTIONAL_MISSING: `"STRING" (default)` }
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
      envPrintable: { V: "true (default)" }
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
      envPrintable: { V: "null (default)" }
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
      envPrintable: { V: "undefined (default)" }
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
      envPrintable: { V: "object (default)" }
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
      envPrintable: { V: "function (default)" }
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

  it("supports turning result into a multi-liner", () => {
    expect(
      Formatter.multiLine({
        envPrintable: {
          A: "value",
          B: "1234"
        }
      })
    ).toEqual(`A = value
B = 1234`);
  });
});

describe("Combine nonNullable()", () => {
  it("returns original result if all values are non-nullable", () => {
    const testValue = {
      A: "a",
      B: "b",
      C: "c"
    };
    expect(Combine.nonNullable(testValue)).toEqual(testValue);
  });

  it("treats false, zero, [], and {}, as non-nullable", () => {
    const testValue = {
      A: "a",
      B: 0,
      C: false,
      D: [],
      E: {}
    };
    expect(Combine.nonNullable(testValue)).toEqual(testValue);
  });

  it("returns null if all are nullable", () => {
    expect(
      Combine.nonNullable({
        A: undefined,
        B: null,
        C: null
      })
    ).toEqual(null);
  });

  it("throws if there is a mix of nonNullable and falsy values", () => {
    expect(() =>
      Combine.nonNullable({
        A: "a",
        B: null,
        C: "c"
      })
    ).toThrow(new Error("Mix of non-nullable (A, C) and nullable (B) values"));
  });
});

describe("Mask", () => {
  describe("url()", () => {
    it("does get invoked for default value", () => {
      const testUrl = "http://user:pass@localhost";
      const defaultValue = new URL(testUrl);
      const result = parseEnvironmentVariables({
        DEFAULT_WITH_MASK: {
          default: defaultValue,
          mask: Mask.url("password")
        }
      });
      expect(result).toEqual({
        success: true,
        env: { DEFAULT_WITH_MASK: defaultValue },
        envPrintable: {
          DEFAULT_WITH_MASK: `<masked: "http://user:*****@localhost/"> (default)`
        }
      });
    });

    it("can read URL objects", () => {
      const testUrl = "http://user:pass@localhost";
      process.env.DB_URL = testUrl;
      const result = parseEnvironmentVariables({
        DB_URL: {
          parser: s => new URL(s), // URL object will go through mask function
          mask: Mask.url("password")
        }
      });
      expect(result).toEqual({
        success: true,
        env: { DB_URL: new URL(testUrl) },
        envPrintable: {
          DB_URL: `<masked: "http://user:*****@localhost/">` // Parser adds a trailing slash
        }
      });
    });

    it("does not mask empty pathname", () => {
      process.env.DB_URL = "http://localhost";
      const result = parseEnvironmentVariables({
        DB_URL: {
          mask: Mask.url("pathname")
        }
      });
      expect(result).toEqual({
        success: true,
        env: { DB_URL: "http://localhost" },
        envPrintable: {
          DB_URL: `<masked: "http://localhost/">` // Parser adds a trailing slash
        }
      });
    });

    it("can mask all parts of the url", () => {
      process.env.DB_URL =
        "http://user:pass@10.11.12.13:8080/some/path?query=foo#hash";
      const result = parseEnvironmentVariables({
        DB_URL: {
          mask: Mask.url(
            "hash",
            "hostname",
            "password",
            "pathname",
            "port",
            "protocol",
            "search",
            "username"
          )
        }
      });
      expect(result).toEqual({
        success: true,
        env: {
          DB_URL: "http://user:pass@10.11.12.13:8080/some/path?query=foo#hash"
        },
        envPrintable: {
          DB_URL: `<masked: "*****://*****:*****@*****:*****/*****?*****#*****">`
        }
      });
    });
  });

  describe("urlPassword()", () => {
    it("masks password", () => {
      process.env.DB_URL = "postgre://user:pass@localhost:5432/db";
      const result = parseEnvironmentVariables({
        DB_URL: {
          mask: Mask.urlPassword
        }
      });
      expect(result).toEqual({
        success: true,
        env: { DB_URL: "postgre://user:pass@localhost:5432/db" },
        envPrintable: {
          DB_URL: `<masked: "postgre://user:*****@localhost:5432/db">`
        }
      });
    });
  });

  describe("urlUsernameAndPassword()", () => {
    it("masks username and password", () => {
      process.env.DB_URL = "postgre://user:pass@localhost:5432/db";
      const result = parseEnvironmentVariables({
        DB_URL: {
          mask: Mask.urlUsernameAndPassword
        }
      });
      expect(result).toEqual({
        success: true,
        env: { DB_URL: "postgre://user:pass@localhost:5432/db" },
        envPrintable: {
          DB_URL: `<masked: "postgre://*****:*****@localhost:5432/db">`
        }
      });
    });
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

const environmentVariableMapping: {
  a: number | null;
  b: string | undefined;
} = {
  a: Math.random() ? 1 : null,
  b: Math.random() ? "b" : undefined
};
const nonNullableResult: { a: number; b: string } | null = Combine.nonNullable(
  environmentVariableMapping
);
nonNullableResult;
