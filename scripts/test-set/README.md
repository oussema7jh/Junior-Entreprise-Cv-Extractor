# CV test set (S1-18)

**Private data.** The LinkedIn and dataset CVs are real people.
The CVs and `expected.csv` live in Ahmed's private Drive, never on GitHub. To use them, put them in `cv-test-set/`
at the repo root (git ignores it, and `eval-results/` too): `linkedin/`, `dataset/`, `fictional/`, `html/`, `expected.csv`.
The scripts in this folder only rebuild the fictional part; they contain no real person's data.

## Where the 30 CVs come from

| Folder | Count | Source |
|---|---|---|
| `linkedin/` | 10 | CVs that Tunisian students and job seekers posted publicly on LinkedIn (collected 29 Oct 2026, use approved by Ahmed). Page images as LinkedIn shows them; `li01` is 2 pages merged into an image-only PDF. Only page 1 was saved for `li07`–`li09`, so their skills, education and languages are not in the file (the AI correctly returns them empty). |
| `dataset/` | 10 | [amnamine/ResumeDataset](https://huggingface.co/datasets/amnamine/ResumeDataset) on Hugging Face (French Canva-style CVs). `ds11`–`ds15` were turned into phone photos with `make_photo.py`. |
| `fictional/` | 10 | Invented Tunisian candidates, built by `make_fictional.py`. Their answers are exact, so `expected.csv` covers them. `fx27` is turned into an office scan with `scan.py`. |

## Coverage of the S1-18 categories

| Category | Files |
|---|---|
| French | li01, li02, li04, li05, li06, li07, li10, ds11–ds20, fx21, fx22, fx24, fx25, fx27, fx28, fx29 |
| English | li08, li09, fx23, fx26 (and li03 if mostly English) |
| Some Arabic | fx22 (name), fx25 (Arabic section and language), fx30 (Arabic CV with French degree name) |
| 2 pages | li01, ds20, fx24 |
| Simple Word style | li04, li05, fx21, fx24, fx27, fx30 |
| Designed, columns and icons (Canva style) | ds11–ds19, fx22, fx23, fx25, fx26, fx28, fx29 |
| Scans or phone photos (at least 5) | ds11–ds15 (phone photos), fx27 (scan), li01 (image-only PDF) |
| Non-students / job seekers (at least 2) | li03, li06, li07, li10, fx25, fx28, fx30 |

## expected.csv

10 rows (the fictional CVs): full name, email, phone, school, latest degree, 5 main skills, languages.
Skills and languages are separated by `; `.

To rebuild the fictional CVs: `python scripts/test-set/make_fictional.py`. It needs Windows with Microsoft Edge (to print
the PDFs) and Pillow for the scan and photo effects (`pip install pillow`; only these scripts use it, so it is not in the
worker's requirements). It also writes `html/`, the source text `python -m cv_worker.check_invented` compares answers with.
