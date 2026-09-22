# Sidecars

A sidecar puts a Python-only model behind `POST /v1/systemone` so stuntdouble can treat it like any other backend. Each one is a single standard-library file that loads the model once and answers on localhost.

| File | Wraps | Install | Run |
| --- | --- | --- | --- |
| `laya.py` | [laya-mlx](https://github.com/mizorewww/laya-mlx), Convai's 421M typed-decision model on Apple Silicon | `pip install laya-mlx` (Python 3.11+, macOS 14+) | `python sidecars/laya.py --port 8011` |
| `kev-space.mjs` | The [Kev Hugging Face Space](https://huggingface.co/spaces/jaredpalmer/kev): Kev-4B or Kev-0.8B on ZeroGPU, fp32, same API code as `kev.serve` | nothing (Node only). A Hugging Face login (`HF_TOKEN` or `~/.cache/huggingface/token`) is needed in practice; anonymous calls time out in the ZeroGPU queue | `node sidecars/kev-space.mjs --port 8012 --model Kev-4B` |

The Space sidecar is for machines that cannot hold Kev-4B locally. Each call waits in the ZeroGPU queue, so latency is 5 to 60 seconds and not comparable to a local server; pass `--timeout 300000` to `suite run`. ZeroGPU has a per-account quota, and the Space returns an error when it is exhausted; the record then shows `error: "http 502"` for that backend. It is calibrated by default (`--calibrated false` for raw logits), matching what `kev.serve` applies.

Then in `stuntdouble.json`:

```json
{ "name": "laya", "url": "http://127.0.0.1:8011", "model": "laya-latest", "timeoutMs": 10000 }
```

Backends that already speak the wire shape need no sidecar: [Kev](https://github.com/jaredpalmer/kev) (`python -m kev.serve --run jaredpalmer/kev-4b --port 8009`), [jeff](https://github.com/logan-markewich/jeff), [djev](https://api.djev.dev), and TypeSafe's own API.

Not yet wrapped: [SemIf](https://github.com/TheoLeeCJ/SemIf) ships a batch scorer rather than a server. A sidecar for it is issue #2.

Laya's answers carry an extra `action` object; the sidecar drops it because it is not part of the wire shape. Everything else is passed through as the library returns it.
