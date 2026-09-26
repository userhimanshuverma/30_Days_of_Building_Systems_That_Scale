# 🤝 Contributing to 30 Days of Building Systems That Scale

Thank you for your interest in improving **30 Days of Building Systems That Scale**!

This project is a practical, production-focused engineering curriculum chronicling the architectural evolution of a real-world system from a single server to 100,000+ RPS multi-region scale.

---

## 🌟 How Can You Contribute?

You can contribute in several ways:
1. **Fixing Typos or Errata**: Found a typo, unclear explanation, or calculation error in any day's guide? Submit a PR!
2. **Enhancing System Evolution Milestones**: Improving Docker Compose configurations, adding realistic mock services, or refining health probes.
3. **Adding / Tuning Lab Experiments**: Contributing additional k6 scenarios, Toxiproxy chaos configurations, or benchmark tests in the `labs/` directory.
4. **Improving Diagrams**: Submitting editable Mermaid source diagrams (`diagrams/src/`) or rendered diagrams.

---

## 📋 Repository Structure

When contributing, please respect the established folder structure:

* `days/`: 30 structured daily guides organized across 6 distinct phases. Daily guides adhere strictly to the format in `templates/daily-readme-template.md`.
* `architecture/`: High-level Architectural Snapshots and ADR indexes representing the 7 milestone stages (`v1` to `v7`). Adheres to `templates/architecture-snapshot-template.md`.
* `system-evolution/`: Runnable Docker Compose environments corresponding to each architecture milestone (`v1-monolith` through `v7-global-architecture`).
* `labs/`: Executable scripts and experiments (`load-testing/`, `failure-injection/`, `benchmarks/`).
* `diagrams/`: Editable source diagrams (`src/`) and exported visuals (`render/`).

---

## 🛠️ Contribution Guidelines

### 1. Document Format & Style
- Every daily guide should focus on real-world engineering trade-offs, failure modes, metrics, and concrete code/configuration.
- Avoid vague theoretical generalizations. Provide concrete numbers, latencies, failure scenarios, and architecture diagrams.
- Use GitHub Flavored Markdown and valid Mermaid diagrams.

### 2. Code & Lab Quality
- All scripts in `labs/` (e.g. k6 scripts, chaos scripts) should be runnable and documented.
- All Docker Compose configurations should use realistic environment variables and health checks.

### 3. Submitting a Pull Request
1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/day-xx-enhancement
   ```
2. Make your edits and verify all markdown links.
3. Commit your changes with a descriptive commit message:
   ```bash
   git commit -m "docs(day-14): clarify backpressure drop-tail policy with metrics"
   ```
4. Push to your branch and open a Pull Request against `main`.

---

## 📜 Code of Conduct

Please treat all contributors and community members with respect, patience, and empathy. We are all here to learn and build better software systems together.
