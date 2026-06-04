// show UI-Template
figma.showUI( __html__, {
	width: 800,
	height: 700,
});

// main function to collect css-code and post it to UI
async function run() {

	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	const primitiveCollection = collections.find((c) => c.name === "Primitives");
	const semanticCollection = collections.find((c) => c.name === "Semantic");

	if (!primitiveCollection) {
		figma.notify("Collection 'Primitives' nicht gefunden");
		return;
	}

	if (!semanticCollection) {
		figma.notify("Collection 'Semantic' nicht gefunden");
		return;
	}

	let css = "";

	css += await buildPrimitiveSection(primitiveCollection);
	css += "\n\n";
	css += await buildSemanticSection(semanticCollection);

	figma.ui.postMessage({
		type: "EXPORT",
		css,
	});
}

// returns variable-name, replaces / with - and Color with clr
function tokenName(name: string) {
	return '--' + name.replace(/\//g, "-").replace('Color', "clr");
}

// returns RGB value as HEX
function rgbToHex(color: RGB) {
	const toHex = (value: number) =>
		Math.round(value * 255)
			.toString(16)
			.padStart(2, "0");

	return "#" + toHex(color.r) + toHex(color.g) + toHex(color.b);
}

// returns RGB value as HSL
function rgbToHsl(color: RGB) {
	const r = color.r;
	const g = color.g;
	const b = color.b;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);

	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	const d = max - min;

	if (d !== 0) {
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}

		h *= 60;
	}

	return {
		h: Math.round(h),
		s: Math.round(s * 100),
		l: Math.round(l * 100),
	};
}

// returns RGB/RGBA as HEX/HEXA
function colorToCssHEX(color: RGBA | RGB): string {
	const hex = rgbToHex(color);

	if ("a" in color && color.a < 1) {
		return (
			hex +
			Math.round(color.a * 255)
				.toString(16)
				.padStart(2, "0")
		);
	}

	return hex;
}

// returns RGB/RGBA as HSL/HSLA
function colorToCssHSL(color: RGB | RGBA): string {
	const { h, s, l } = rgbToHsl(color);

	if ("a" in color && color.a < 1) {
		return `hsla(${h}, ${s}%, ${l}%, ${color.a})`;
	}

	return `hsl(${h}, ${s}%, ${l}%)`;
}

// returns CSS-Variable depending if it's a
async function resolveAlias(value: VariableValue): Promise<string> {
	if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
		const variable = await figma.variables.getVariableByIdAsync(value.id);

		if (!variable) {
			return "undefined";
		}

		return `var(${tokenName(variable.name)})`;
	}

	if (typeof value === "object" && value !== null && "r" in value) {
		return colorToCssHSL(value as RGB);
	}

	return String(value);
}

// build CSS for primitive values
async function buildPrimitiveSection(collection: VariableCollection) {

	let css = `    color-scheme: light dark;\n\n`;
		
	css += `    /* Primitives */\n`;

	return ( async () => {

		let variableNameShort = "";

		for (const variableId of collection.variableIds) {

			const variable = await figma.variables.getVariableByIdAsync(variableId);

			const variableName = variable.name.toLowerCase();

			// add line when new main value
			let tempVariableNameShort = variableName.slice(variableName.indexOf('/')+1, variableName.lastIndexOf('/'))
			if(variableNameShort != tempVariableNameShort) {
				variableNameShort = tempVariableNameShort;
				css += `\n`;
			}

			if (!variable || variableName.includes("spacing") || variableName.includes("border") ) continue;

			const mode = collection.defaultModeId;
			const value = variable.valuesByMode[mode];

			let cssValue = "";

			if (typeof value === "object" && value !== null && "r" in value) {
				cssValue = colorToCssHSL(value as RGB);
			} else {
				cssValue = String(value) + "px";
			}

			css += `    ${tokenName(variable.name).toLowerCase()}: ${cssValue};\n`;
		}

		return css;
	})();
}

async function buildSemanticSection(collection: VariableCollection) {

	const lightMode = collection.modes.find((mode) => mode.name.toLowerCase() === "light");
	const darkMode = collection.modes.find((mode) => mode.name.toLowerCase() === "dark");

	if (!lightMode || !darkMode) {
		throw new Error("Light oder Dark Mode fehlt.");
	}

	let css = `    /* Semantic */\n`;
	
	return (async () => {

		let variableNameShort = "";

		for (const variableId of collection.variableIds) {
			
			const variable = await figma.variables.getVariableByIdAsync(variableId);

			const variableName = variable.name.toLowerCase();
			let tempVariableNameShort = variableName.slice(variableName.indexOf('/')+1, variableName.lastIndexOf('/'));

			if(variableNameShort != tempVariableNameShort) {
				variableNameShort = tempVariableNameShort;
				css += `\n`;
			}

			if (!variable) continue;

			const value = variable.valuesByMode[lightMode.modeId];
			
			if (typeof value === "object" && value !== null) {

				const lightValue = variable.valuesByMode[lightMode.modeId];
				const darkValue = variable.valuesByMode[darkMode.modeId];
				const light = await resolveAlias(lightValue as VariableValue);
				const dark = await resolveAlias(darkValue as VariableValue);

				css += `    ${tokenName(variable.name).toLowerCase()}: light-dark(${light.toLowerCase()}, ${dark.toLowerCase()});\n`;
			}
		}

		return css;

	})();
}

// run script
run().catch((error) => {
	console.error(error);
	figma.notify("Fehler beim Export.");
});
