# Launch report: Kev-0.8B (star) vs Laya 421M (double), 22 September 2026

This is the first report stuntdouble produced, on the machine that built it. It is a comparison between two local models, not the Jev-versus-local comparison the tool is for. Issue [#1](https://github.com/ReallyArtificial/stuntdouble/issues/1) asks for that run.

## Setup

| | |
| --- | --- |
| Machine | MacBook Pro, Apple M3 Pro, 18 GB unified memory, macOS 24.6 |
| Star | [Kev-0.8B](https://huggingface.co/jaredpalmer/kev-0.8b) via `python -m kev.serve --run jaredpalmer/kev-0.8b`, `KEV_DTYPE=bf16`, MPS. Kev-4B was tried twice: once it swapped the machine to a standstill during load; the second time, with swap nearly empty, it loaded in 23 s and opened its port, but the first real request hung for 180 s while swap climbed to 13 GB. 18 GB is not enough for the 4B model beside a desktop session. |
| Double | [Laya](https://huggingface.co/aac6fef/laya-mlx) 421M through [sidecars/laya.py](../../sidecars/laya.py), MLX 0.32.2, Python 3.12 |
| Jev | Not run. No TypeSafe API key was available on this machine. |
| stuntdouble | commit at the time of the run, `node src/cli.mjs suite run …`; reports rendered with `--max-disagreement 0.05` |
| Runner | `suite run` calls star and double concurrently per item, sequentially across items |

Sixteen of the 300 Kev-suite rows and four of the 111 JevBench rows carry a star error and are excluded from every agreement and accuracy figure: the sixteen are Score answers whose two-decimal probabilities made the reported mean drift past the validator's tolerance at the time of the run (the tolerance was widened in the next commit; a rerun was stopped at 290 of 300 to free the machine), the four are 30-second timeouts on long JevBench states with both models loaded.

A 500-row pass of the Kev suite was attempted after the Kev-4B retry and abandoned: with the machine still paging, Kev-0.8B timed out at 30 s on every one of the first five rows and Laya took 3 to 11 s per row, so the 300-row file above remains the committed one. Issue [#1](https://github.com/ReallyArtificial/stuntdouble/issues/1) asks for a run on a machine with headroom and a Jev key.

**Kev-4B through the Hugging Face Space (partial).** A third route was tried with [sidecars/kev-space.mjs](../../sidecars/kev-space.mjs), which puts the Kev Space (Kev-4B on ZeroGPU, fp32, calibrated) behind the wire endpoint. It answered in 3 to 60 s per call with a free Hugging Face login, then the account's ZeroGPU quota ran out 6 records into the jev-by-example suite; the remaining 22, and the two other suites, returned the Space's quota error. The six valid records are kept as `records/kev-4b-space-partial-jev-by-example.jsonl`: Kev-4B and Laya made the same application decision on 5 of the 6 cases (they split on 02/permanent-correction, where Kev-4B proposed the replacement and Laya asked for review), and Kev-4B matched the authored intended outcome on 4 of 6. Six rows are not a result; they are a demonstration that the route works for anyone with quota, which a PRO account has 40 minutes of per day.

Latency figures are for this machine with both models loaded at once and other applications running; treat them as indicative only.

## Files

| File | Suite | Rows |
| --- | --- | --- |
| `jev-by-example.md` / `.json` | [jev-by-example](https://github.com/ReallyArtificial/jev-by-example) at `79992cd`, all cases that reach the model | 28 cases, 55 questions, policy agreement computed |
| `kev-decision-v2-300.md` / `.json` | [Kev `evals/decision-v2/test.jsonl`](https://github.com/jaredpalmer/kev/blob/main/evals/decision-v2/test.jsonl), 300 rows sampled with seed 20260922 from 1,176 | labeled, banking77 / agnews / mnli / trec / dbpedia14 / boolq / sst5 / yelp / amazon / imdb / contrastive |
| `jevbench-hard.md` / `.json` | [JevBench `datasets/public/hard.jsonl`](https://github.com/fstandhartinger/jevbench/blob/main/datasets/public/hard.jsonl), all 111 public hard items | labeled, one Choice or Noul or Score per item, states of about 4k tokens |
| `records/*.jsonl` | Raw records for the three runs, including every request and answer | replayable with `stuntdouble replay` |

Kev's frozen suite is a set Kev was trained toward in part (`trainable_sources` in its manifest), so Kev-0.8B's accuracy on it is an in-distribution number. Laya was not trained on it as far as its card says.

## How to reproduce

```sh
git clone https://github.com/ReallyArtificial/stuntdouble && cd stuntdouble
git clone https://github.com/ReallyArtificial/jev-by-example ../jev-by-example
# terminal 1: Kev
pip install uv && git clone https://github.com/jaredpalmer/kev ../kev && cd ../kev && uv sync --extra serve && KEV_DTYPE=bf16 uv run python -m kev.serve --run jaredpalmer/kev-0.8b --port 8009
# terminal 2: Laya
pip install laya-mlx && python sidecars/laya.py --port 8011
# terminal 3
STAR="kev-0.8b=http://127.0.0.1:8009,kev-latest"; DBL="laya=http://127.0.0.1:8011,laya-latest"
node src/cli.mjs suite run jbe:../jev-by-example --star "$STAR" --double "$DBL" --out records/jbe.jsonl
node src/cli.mjs suite import kev ../kev/evals/decision-v2/test.jsonl --out suites/kev.jsonl
node src/cli.mjs suite run suites/kev.jsonl --sample 300 --star "$STAR" --double "$DBL" --out records/kev.jsonl
curl -sLO https://raw.githubusercontent.com/fstandhartinger/jevbench/HEAD/datasets/public/hard.jsonl
node src/cli.mjs suite import jevbench hard.jsonl --out suites/jevbench.jsonl
node src/cli.mjs suite run suites/jevbench.jsonl --star "$STAR" --double "$DBL" --out records/jevbench.jsonl
node src/cli.mjs report records/jbe.jsonl --max-disagreement 0.05 --min-rows 10
```

Swap `$STAR` for `jev=https://api.typesafe.ai,jev-1.13.0` with a `stuntdouble.json` that carries the bearer header to get the report this tool exists for.
