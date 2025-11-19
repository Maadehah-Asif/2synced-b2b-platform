# CatBoost on Python 3.13 (Windows)

As of 2025-11, the CatBoost project does not publish Windows wheels for CPython 3.13 on PyPI. Installing `catboost` on Python 3.13 will often attempt a source build and fail or require heavy toolchains.

Options to proceed:

1) Preferred: Use Python 3.10 for CatBoost
   - CatBoost wheels are available for Python 3.10. Create a separate venv:
     - `py -3.10 -m venv .venv310`
     - `./.venv310/Scripts/Activate.ps1`
     - `pip install --prefer-binary catboost==1.2.8`
   - Keep your main project on 3.13 if desired, and run CatBoost tasks in the 3.10 venv.

2) Conda-forge (sometimes provides newer wheels)
   - Create a conda env targeting Python 3.13 and try:
     - `conda create -n ml313 python=3.13`
     - `conda activate ml313`
     - `conda install -c conda-forge catboost`
   - If conda-forge has no 3.13 builds yet for Windows, fall back to option (1).

3) Build from source (NOT RECOMMENDED on Windows)
   - Requires: MSVC (Build Tools), CMake, Git, and a compatible toolchain.
   - Extremely slow and fragile for most setups.

Pragmatic guidance:
- If your model artifact is a CatBoost `.pkl`, unpickling requires the `catboost` package. Without it, loading will fail.
- If you can migrate the model to a scikit-learn/XGBoost/LightGBM pipeline, you may avoid the `catboost` dependency entirely (export/retrain).
- Otherwise, use a Python version with readily available wheels (3.10 is the most straightforward).
