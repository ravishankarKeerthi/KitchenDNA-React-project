# KitchenDNA — Kitchen Operations Intelligence Simulator

An interactive React/Vite prototype for exploring kitchen operations across four sample environments: hotel kitchens, restaurants, central kitchens, and bakeries.

## Included prototype interactions
- Switch between four industry scenarios.
- Change demand and target dispatch time.
- Adjust available staff and cooking/oven capacity.
- Simulate one equipment station becoming unavailable.
- Review estimated workload across preparation, cooking/baking, and packing.
- See ingredient requirement and illustrative stock-shortage calculations.
- Compare current scenario workload with the selected industry's baseline.
- Apply a simple recovery experiment by adding one staff member.

## Important limitations
This is a concept prototype, not a production planning system. Values are illustrative and are not connected to live inventory, recipes, staff rosters, or equipment. The workload formula is simplified and should be validated with real operational data before decisions are based on it. Browser state resets on refresh. There is no login, database, tenant separation, or live integration.

## Publish to GitHub Pages
The repository is configured for the project URL `https://ravishankarkeerthi.github.io/KitchenDNA-React-project/`.

1. In your GitHub repository, open **Code**.
2. Upload the extracted contents of this project ZIP to the repository root, replacing the matching project files when prompted. Keep `.github/workflows/deploy.yml` and `vite.config.js`.
3. Commit the changes to the `main` branch.
4. Open **Actions** and wait for **Deploy KitchenDNA to GitHub Pages** to finish with a green check.
5. Open the Pages URL and press Ctrl+F5 to reload.

The GitHub Actions workflow runs `npm install`, `npm run build`, then deploys the generated `dist` folder. If the build fails, open the failed run and review the first red error.

## Run locally (optional)
Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```
