# Local Model Artifacts

Place your local zipped model here:

- `backend/models/mood_model.zip`

This file is expected to be tracked with Git LFS (see root `.gitattributes`).

## One-time setup

```bash
git lfs install
git lfs track "backend/models/*.zip"
```

## Add model to repo path

```bash
cp /Users/krishnasiddharth/Downloads/mood_model.zip backend/models/mood_model.zip
```

Then commit and push as usual.
