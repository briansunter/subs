module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation only changes
        "style", // Code style changes (formatting, etc.)
        "refactor", // Code refactoring
        "perf", // Performance improvements
        "test", // Adding or updating tests
        "chore", // Other changes (build, config, etc.)
        "ci", // CI/CD related changes
        "revert", // Revert a previous commit
        "build", // Build system changes
      ],
    ],
    "scope-enum": [
      2,
      "always",
      ["routes", "services", "tests", "deps", "config", "docker", "ci", "docs"],
    ],
    "subject-case": [0], // Allow any case for subject
  },
};
