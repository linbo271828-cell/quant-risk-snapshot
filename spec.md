# 21-266 Quiz App Specification

## Project overview

Build a local, terminal-based quiz app for studying CMU 21-266. The app should help a user create an account, log in, take quizzes from a human-editable question bank, receive immediate feedback, save secure-ish progress locally, and gradually adapt question selection based on both performance and explicit likes/dislikes.

This is a CLI-only project. No backend, browser UI, HTML, CSS, or APIs are needed.

## Main goals

1. Make it easy to study 21-266 topics from a JSON question bank.
2. Keep questions easy to edit by hand.
3. Keep passwords out of plaintext.
4. Keep score history and feedback data **not human-readable** to a casual viewer.
5. Let users influence future question selection by marking questions as liked or disliked.
6. Support one study-focused extension feature.

## Non-goals

- Multi-device sync
- Cloud storage
- Instructor/admin roles
- Networked multiplayer
- Strong enterprise-grade security against a determined attacker with code access

---

## Behavior description

### Startup flow

1. The user runs the program from the terminal, e.g. `python main.py`.
2. The app loads:
   - the human-readable question bank from `data/questions.json`
   - the account database from `data/users.db`
   - the encrypted/binary history file from `data/history.dat`
3. If any required file is missing or invalid, the app prints a clear, friendly error or creates the file when appropriate.

### Authentication flow

4. The app displays a welcome screen with options:
   - Log in
   - Create account
   - Exit
5. If the user creates an account:
   - the app asks for a username
   - the app checks that the username is not already taken
   - the app asks for a password twice
   - the password is hashed with a strong salted hash before storage
   - the app creates an empty progress/history record for the new user
6. If the user logs in:
   - the app asks for username and password
   - the password is verified against the stored salted hash
   - if valid, the user enters the main menu
   - if invalid, the user sees a friendly error and can retry

### Main menu flow

7. After login, the user sees a main menu:
   - Start quiz
   - View score history
   - View topic stats
   - Log out
   - Exit

### Quiz setup flow

8. If the user chooses **Start quiz**, the app asks:
   - How many questions do you want?
   - Which topics do you want? (`all` or one/more topics names)
   - Do you want mixed difficulty or a chosen difficulty (`easy`, `medium`, `hard`, `all`)?
   - p.s. Difficulty is generally followed by whether the question is covered in lecture, recitation, a homework question, or extraciricular in this order of difficulty, but take this with a grain of salt.
9. The app filters eligible questions by topics and difficulty.
10. The app then chooses questions using **weighted random selection**:
    - base weight = 1.0
    - previously answered incorrectly: increase weight
    - liked by user: increase weight slightly
    - disliked by user: decrease weight
    - repeatedly answered correctly across past sessions: decrease weight
    - very recently seen in the same session: do not repeat
11. If too few questions match the filter, the app:
    - warns the user
    - offers to use all matching questions
    - or lets the user change the setup

### Question flow

12. For each question, the app shows:
    - question number (e.g. `Question 3 of 10`)
    - category
    - difficulty
    - question text
13. The app supports these question types:
    - `multiple_choice`
    - `true_false`
    - `short_answer`
14. For multiple-choice questions:
    - options are displayed with labels such as `A`, `B`, `C`, `D`
    - the user may enter either the letter or the full option text
15. For true/false questions:
    - accepted inputs include `true`, `false`, `t`, `f`
16. For short-answer questions:
    - matching is case-insensitive
    - leading/trailing spaces are ignored
    - the app may use an optional `accepted_answers` list for equivalent forms

### Extension feature: hint system

17. While answering a question, the user may type `hint` once.
18. If a hint exists for that question:
    - the app displays the hint
    - the question remains unanswered
    - the maximum score for that question is reduced
19. Scoring rule with hint:
    - normal correct answer = 1.0 point
    - correct after hint = 0.75 points
    - incorrect = 0 points
20. If no hint exists, the app tells the user that no hint is available.

### After each question

21. The app tells the user whether they were correct.
22. The app shows:
    - the correct answer
    - a short explanation, if available
23. The app then asks for question feedback:
    - `like`
    - `dislike`
    - `skip`
24. The feedback is saved and affects future selection weights.

### End-of-quiz flow

25. At the end of the quiz, the app shows:
    - raw score
    - percentage
    - number correct
    - number answered with hints
    - category breakdown
26. The app saves session data to the encrypted history file.
27. The app returns the user to the main menu.

### History/statistics flow

28. If the user chooses **View score history**, the app shows:
    - total quizzes taken
    - average score
    - best score
    - most recent score
    - total questions answered
    - overall accuracy
29. If the user chooses **View category stats**, the app shows per-category:
    - attempts
    - correct count
    - accuracy
    - liked count
    - disliked count
30. Stats are read from the encrypted history file and displayed in a readable CLI format, but the underlying file on disk is binary/encrypted.

---

## Data format

The question bank must be stored in a human-readable JSON file. The base structure below should be preserved. The app may extend it with extra fields like `id`, `difficulty`, `hint`, `explanation`, `accepted_answers`, and `lecture`.

### Required base structure

```json
{
  "questions": [
    {
      "question": "What keyword is used to define a function in Python?",
      "type": "multiple_choice",
      "options": ["func", "define", "def", "function"],
      "answer": "def",
      "category": "Python Basics"
    }
  ]
}
```

### Proposed 21-266 question format

```json
{
  "questions": [
    {
      "id": "q001",
      "question": "What type of quadric surface is given by x^2 + y^2 - z = 3?",
      "type": "multiple_choice",
      "options": [
        "Elliptic paraboloid",
        "Hyperbolic paraboloid",
        "Cone",
        "Ellipsoid"
      ],
      "answer": "Elliptic paraboloid",
      "category": "Quadrics",
      "difficulty": "easy",
      "hint": "Solve for z and compare with standard quadric forms.",
      "explanation": "Rearranging gives z = x^2 + y^2 - 3, which is an elliptic paraboloid shifted downward.",
      "lecture": 3
    },
    {
      "id": "q002",
      "question": "The limit of (x^2 - y^2)/(x^2 + y^2) as (x,y) approaches (0,0) exists.",
      "type": "true_false",
      "answer": "false",
      "category": "Limits",
      "difficulty": "medium",
      "hint": "Try approaching along y = 0 and x = 0.",
      "explanation": "Along y = 0 the expression is 1, while along x = 0 it is -1, so the limit does not exist.",
      "lecture": 7
    },
    {
      "id": "q003",
      "question": "What vector is normal to the tangent plane of a level surface F(x,y,z) = c at a point where grad F is nonzero?",
      "type": "short_answer",
      "answer": "gradient",
      "accepted_answers": ["gradient", "grad f", "∇f", "nabla f", "the gradient"],
      "category": "Tangent Planes",
      "difficulty": "easy",
      "hint": "Think about the standard tangent plane formula for level sets.",
      "explanation": "The gradient is perpendicular to the level surface, so it is a normal vector to the tangent plane.",
      "lecture": 14
    },
    {
      "id": "q004",
      "question": "A continuous function on a closed and bounded region must attain a global maximum and minimum.",
      "type": "true_false",
      "answer": "true",
      "category": "Optimization",
      "difficulty": "easy",
      "hint": "This is the Extreme Value Theorem.",
      "explanation": "The Extreme Value Theorem guarantees both extrema on compact sets.",
      "lecture": 12
    },
    {
      "id": "q005",
      "question": "Which method is used to find constrained extrema?",
      "type": "multiple_choice",
      "options": [
        "Partial fraction decomposition",
        "Lagrange multipliers",
        "Integration by parts",
        "Gaussian elimination"
      ],
      "answer": "Lagrange multipliers",
      "category": "Optimization",
      "difficulty": "easy",
      "hint": "This method introduces a multiplier lambda.",
      "explanation": "Lagrange multipliers are used when optimizing with one or more constraints.",
      "lecture": 15
    },
    {
      "id": "q006",
      "question": "A vector field with zero curl on a simply connected domain is conservative.",
      "type": "true_false",
      "answer": "true",
      "category": "Vector Fields",
      "difficulty": "medium",
      "hint": "The domain condition matters.",
      "explanation": "On a simply connected domain, curl-free vector fields are conservative under the course assumptions.",
      "lecture": 17
    },
    {
      "id": "q007",
      "question": "What theorem lets you evaluate a line integral of a conservative vector field using only endpoints?",
      "type": "short_answer",
      "answer": "fundamental theorem of line integrals",
      "accepted_answers": [
        "fundamental theorem of line integrals",
        "the fundamental theorem of line integrals",
        "ftli"
      ],
      "category": "Line Integrals",
      "difficulty": "medium",
      "hint": "It is the line-integral analogue of the FTC idea.",
      "explanation": "If F = grad f, then the line integral depends only on endpoint values of the potential f.",
      "lecture": 21
    }
  ]
}
```

### Data rules

- Every question must have a stable unique `id`.
- `type` must be one of:
  - `multiple_choice`
  - `true_false`
  - `short_answer`
- `options` is required only for `multiple_choice`.
- `accepted_answers` is optional and valid only for `short_answer`.
- `difficulty` should be one of `easy`, `medium`, `hard`.
- `hint` and `explanation` are optional but recommended.
- `category` must be a non-empty string.
- The app should reject duplicate question IDs.

---

## Scoring and adaptation rules

### Scoring

- Correct without hint: `+1.0`
- Correct after hint: `+0.75`
- Incorrect: `+0.0`

### Per-user tracked stats

For each user, track at least:

- total quizzes taken
- total questions seen
- total correct
- overall accuracy
- per-category attempts and accuracy
- best score
- most recent score
- question-level counts:
  - times seen
  - times correct
  - times incorrect
  - likes
  - dislikes
  - last seen timestamp

### Question selection weighting

For each eligible question, compute something like:

```text
weight = 1.0
if previously incorrect: +0.75
if liked: +0.25
if disliked: -0.40
if mastered (e.g. 3+ correct and >= 80% accuracy): -0.50
if seen in most recent quiz: multiply by 0.25
minimum weight floor = 0.10
```

This is not meant to be mathematically perfect. It just needs to make future quizzes feel smarter:
- missed questions come back more often
- liked questions show up somewhat more often
- disliked questions show up less often
- over-mastered questions appear less often

---

## Security/storage design

### Local login system

Use a local account database, preferably SQLite.

Each account record should store:
- username
- random salt
- password hash
- account creation timestamp

### Password storage requirement

Passwords must **never** be stored in plaintext.

Recommended implementation:
- `hashlib.pbkdf2_hmac("sha256", password_bytes, salt, 200000)`  
- store only the salt and derived hash

This is appropriate for a local student project and makes passwords nontrivial to discover.

### Score history/security requirement

The score history file should:
- be stored separately from the human-readable question bank
- not be readable in a text editor
- not expose passwords
- ideally not expose score values to casual inspection

Recommended implementation:
- store user auth in `users.db`
- store progress/history as encrypted JSON bytes in `history.dat`
- use a local symmetric key in `secret.key`
- on first run, generate the key if it does not exist

Security note:
This protects against **casual inspection**, not a determined attacker with full access to source code and runtime secrets. That is acceptable for this project.

---

## File structure

```text
quiz-app/
├── SPEC.md
├── README.md
├── main.py
├── auth.py
├── quiz_engine.py
├── question_loader.py
├── storage.py
├── models.py
├── utils.py
├── data/
│   ├── questions.json
│   ├── users.db
│   ├── history.dat
│   └── secret.key
└── tests/
    └── test_quiz_core.py
```

### File responsibilities

- `SPEC.md`  
  Detailed project specification. Written before implementation.

- `README.md`  
  How to run the app, dependency notes, project overview, and known limitations.

- `main.py`  
  Entry point. Displays menus and coordinates the app flow.

- `auth.py`  
  Create account, login, password hashing, password verification.

- `quiz_engine.py`  
  Quiz setup, question selection, answer checking, scoring, feedback prompt.

- `question_loader.py`  
  Load/validate `questions.json`, enforce schema rules, detect duplicate IDs.

- `storage.py`  
  Read/write history data, encryption/decryption, stats updates.

- `models.py`  
  Shared data structures/constants (question types, difficulty values, stat keys).

- `utils.py`  
  Input helpers, normalization functions, timestamp helpers, CLI formatting.

- `data/questions.json`  
  Human-readable question bank. Manually editable.

- `data/users.db`  
  SQLite database for usernames, salts, password hashes.

- `data/history.dat`  
  Encrypted binary history, stats, and feedback storage.

- `data/secret.key`  
  Local key for encrypting/decrypting `history.dat`.

- `tests/test_quiz_core.py`  
  Tests for loader, answer normalization, scoring, and selection behavior.

---

## Error handling

The app must fail clearly and safely. At minimum, handle the following cases.

### Error case 1: missing `questions.json`

**Situation:** The file does not exist.  
**Behavior:**  
- print: `Error: data/questions.json was not found. Please add a question bank and try again.`
- exit with status code `1`

### Error case 2: malformed JSON in question bank

**Situation:** The JSON is syntactically invalid.  
**Behavior:**  
- print a friendly parse error with filename
- do not crash with a traceback unless running in debug mode
- exit with status code `1`

### Error case 3: invalid question schema

Examples:
- missing `answer`
- unknown `type`
- multiple-choice question missing `options`
- duplicate `id`

**Behavior:**  
- print which question failed validation
- do not start the quiz
- exit with status code `1`

### Error case 4: empty filtered question set

**Situation:** The user asks for a category/difficulty combination with zero matches.  
**Behavior:**  
- explain that no questions match the filter
- let the user choose again without losing login state

### Error case 5: invalid menu input

**Situation:** The user types `banana` when the menu expects `1-5`.  
**Behavior:**  
- print `Invalid choice. Please enter one of the listed options.`
- reprompt without crashing

### Error case 6: invalid answer format

**Situation:** The user enters `E` for a 4-option multiple-choice question.  
**Behavior:**  
- print a short error
- allow re-entry
- do not count the question wrong unless the user explicitly submits an answer

### Error case 7: corrupted history file

**Situation:** `history.dat` cannot be decrypted or parsed.  
**Behavior:**  
- print a warning
- move the corrupted file to `history.dat.bak`
- create a fresh empty history file
- keep the account database intact

### Error case 8: wrong password

**Situation:** Username exists but password is wrong.  
**Behavior:**  
- print `Login failed. Invalid username or password.`
- do not reveal whether the username exists
- allow retry

---

## CLI/UX expectations

- Menus should be short and readable.
- Prompts should clearly state valid input formats.
- The app should avoid dumping raw Python objects to the screen.
- Feedback after each answer should be immediate.
- The user should always know:
  - where they are in the quiz
  - what their current progress is
  - what commands are available (`hint`, etc.)

Example prompt:

```text
Question 2 of 8
Category: Vector Fields | Difficulty: medium

A vector field with zero curl on a simply connected domain is conservative.
Enter answer [true/false] or type 'hint':
> 
```

---

## Acceptance criteria

The implementation is "done" when all of the following are true:

- [ ] Running the app with a valid `questions.json` starts a CLI menu without crashing.
- [ ] Creating a new account stores a salted password hash, not the plaintext password.
- [ ] Logging in with the correct password succeeds, and a wrong password fails cleanly.
- [ ] The app can ask at least the three required question types: multiple choice, true/false, and short answer.
- [ ] The app records quiz history across runs and stores it in a non-human-readable file.
- [ ] The app asks for like/dislike feedback after questions and uses that data in future selection.
- [ ] Typing `hint` on a question with a hint reveals it and reduces the available score for that question.
- [ ] Running the app with a missing, malformed, or invalid question bank prints a friendly error instead of crashing.