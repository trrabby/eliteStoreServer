# 🚀 Project Setup & Contribution Guide

## 🧱 1. Clone the Repository

```bash
git clone https://github.com/SadikRa/assignment-9-server.git
cd assignment-9-server
```

📦 2. Install Dependencies

Using npm:

npm install

Or using yarn:

yarn install

▶️ 3. Run the Development Server

npm run dev

⚙️ Environment Setup

Create a .env file by copying the contents of .env.example.
For Windows (CMD):

copy .env.example .env

For Windows (PowerShell):

Copy-Item .env.example .env

For Mac/Linux:

cp .env.example .env

Then, open .env and update your environment variables (like DATABASE_URL).
🛠️ Git Workflow for Contribution
✅ Step 1: Create a New Branch

Always start from the latest main:
```bash
git checkout main
git pull origin main
git checkout -b yourName/feature-name
```

    🔁 Replace:

        yourName with your actual name or GitHub username.

        feature-name with a short task description like review-crud or fix-payment-bug.

✍️ Step 2: Make Changes and Commit

git add .
git commit -m "feat: short summary of what you added or fixed"

Follow conventional commits:
feat, fix, docs, chore, refactor, etc.
🔄 Step 3: Sync with Main Before Pushing

Stay up-to-date with main:
```bash
git checkout main
git pull origin main
git checkout yourName/feature-name
git rebase main
```

If conflicts appear:

# resolve conflicts manually, then
git add .
git rebase --continue

⬆️ Step 4: Push Your Work

```bash
git push -u origin yourName/feature-name
```

💡 Git Tips

    Run git status often to track file changes.

    Use git log --oneline for a readable history.

    Use git stash to temporarily save changes before switching branches.

📄 Example Branch Name

sadik/add-payment-model
sadik/fix-review-bug
