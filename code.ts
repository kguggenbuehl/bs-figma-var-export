// show UI-Template
figma.showUI( __html__, {
	width: 800,
	height: 700,
});

const primitivesFilterValues = ['color', 'fontsize'];
const semanticFilterValues = ['color'];

// main function to collect css-code and post it to UI
async function run(includeDarkMode: boolean) {

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

	css += await buildPrimitiveSection(primitiveCollection, primitivesFilterValues);
	css += "\n\n";
	css += await buildSemanticSection(semanticCollection, semanticFilterValues, includeDarkMode);

	figma.ui.postMessage({
		type: "EXPORT",
		css,
	});
}

// returns variable-name, replaces / with - and Color with clr
function tokenNamePrimitives(name: string) {
	return '--' + name.replace(/\//g, "-").replace('Typography-', "")
}

function tokenNameSemantic(name: string) {

	return name.slice(name.lastIndexOf('/') + 1);
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

// returns CSS-Variable of chosen primitive
async function resolveAlias(value: VariableValue): Promise<string> {
	if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
		const variable = await figma.variables.getVariableByIdAsync(value.id);

		if (!variable) {
			return "undefined";
		}

		return `var(${tokenNamePrimitives(variable.name)})`;
	}

	if (typeof value === "object" && value !== null && "r" in value) {
		return colorToCssHSL(value as RGB);
	}

	return String(value);
}

// build CSS for primitive values
async function buildPrimitiveSection(collection: VariableCollection, primitivesFilterValues: string[]) {

	let css = `    /* Primitives */\n`;

	return ( async () => {

		let variableNameShort = "";

		for (const variableId of collection.variableIds) {

			const variable = await figma.variables.getVariableByIdAsync(variableId);

			const variableName = variable ? variable.name.toLowerCase() : "";
			
			// continue if variable doesn't contain one of the given words
			if (!variable || !primitivesFilterValues.some(word => variableName.includes(word)) ) continue;
			
			// add line when new main value
			const tempVariableNameShort = variableName.slice(variableName.indexOf('/')+1, variableName.lastIndexOf('/'))
			if(variableNameShort != tempVariableNameShort) {
				variableNameShort = tempVariableNameShort;
				css += `\n`;
			}

			const mode = collection.defaultModeId;
			const value = variable.valuesByMode[mode];

			let cssValue = "";

			if (typeof value === "object" && value !== null && "r" in value) {
				cssValue = colorToCssHSL(value as RGB);
			} else {
				cssValue = String(value) + "px";
			}

			css += `    ${tokenNamePrimitives(variable.name).toLowerCase()}: ${cssValue};\n`;
		}

		return css;
	})();
}

async function buildSemanticSection(collection: VariableCollection, semanticFilterValues: string[], includeDarkMode: boolean) {

	const lightMode = collection.modes.find((mode) => mode.name.toLowerCase() === "light");
	const darkMode = collection.modes.find((mode) => mode.name.toLowerCase() === "dark");

	if (!lightMode || (includeDarkMode && !darkMode)) {
		throw new Error("Light oder Dark Mode fehlt.");
	}

	let css = `    /* Semantic */\n`;

	if (includeDarkMode) {
		css += `\n    color-scheme: light dark;\n`;
	}

	return (async () => {

		let variableNameShort = "";

		for (const variableId of collection.variableIds) {

			const variable = await figma.variables.getVariableByIdAsync(variableId);
			const variableName = variable ? variable.name.toLowerCase() : "";

			if (!variable || !semanticFilterValues.some(word => variableName.includes(word))) continue;

			// add line when new main value
			const tempVariableNameShort = variableName.slice(variableName.indexOf('/') + 1, variableName.lastIndexOf('/'));

			if (variableNameShort != tempVariableNameShort) {
				variableNameShort = tempVariableNameShort;
				css += `\n`;
			}

			// values ausgeben
			const lightValue = variable.valuesByMode[lightMode.modeId];

			if (typeof lightValue === "object" && lightValue !== null) {

				const light = await resolveAlias(lightValue as VariableValue);

				if (includeDarkMode && darkMode) {
					const darkValue = variable.valuesByMode[darkMode.modeId];
					const dark = await resolveAlias(darkValue as VariableValue);
					css += `    ${tokenNameSemantic(variable.name).toLowerCase()}: light-dark(${light.toLowerCase()}, ${dark.toLowerCase()});\n`;
				} else {
					css += `    ${tokenNameSemantic(variable.name).toLowerCase()}: ${light.toLowerCase()};\n`;
				}
			}
		}

		return css;

	})();
}

// listen for message from UI (z.B. Button-Klick mit Checkbox-Status)
figma.ui.onmessage = (msg) => {
	if (msg.type === "EXPORT_REQUEST") {
		run(msg.includeDarkMode).catch((error) => {
			console.error(error);
			figma.notify("Fehler beim Export.");
		});
	}
};
