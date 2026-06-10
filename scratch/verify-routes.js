import categoryRoutes from "../src/routes/category.routes.js";
import billRoutes from "../src/routes/bills.routes.js";

console.log("--- Category Routes ---");
categoryRoutes.stack.forEach(layer => {
    if (layer.route) {
        console.log(`Path: ${layer.route.path}, Methods: ${Object.keys(layer.route.methods).join(", ").toUpperCase()}`);
        layer.route.stack.forEach(s => {
            console.log(`  Handler Name: ${s.name}`);
        });
    }
});

console.log("\n--- Bill Routes ---");
billRoutes.stack.forEach(layer => {
    if (layer.route) {
        console.log(`Path: ${layer.route.path}, Methods: ${Object.keys(layer.route.methods).join(", ").toUpperCase()}`);
        layer.route.stack.forEach(s => {
            console.log(`  Handler Name: ${s.name}`);
        });
    }
});
