var stackConstant = 1728;
var nf = new Intl.NumberFormat();
var prioritize = "totalMaterials";
var researchTypes = ['Cube', 'Power', 'Shield', 'Gear'];
var recipes = [];
var materials = {};
var json = null;
var hiddenMaterials = [];
var sadtechData = null;

$(function () {

    $.getJSON('MaterialData.json', function (data) {
        var materialTableRows = [];
        function populateMaterialTable() {
            $.each(materials, function (index, material) {
                var grindIndexText =
                    ' <input type="number" step="0.01" value="' + material["GrindIndex"] + '" min="0" onclick="this.select();" '
                    + ' onblur="updateMaterialGrindIndex(this)" id="' + material["Name"] + '">';
                var priceText =
                    ' <input type="number" step="0.01" value="' + material["MarketPrice"].toFixed(2) + '" min="0" onclick="this.select();" '
                    + ' onblur="updateMaterialMarketPrice(this)" id="' + material["Name"] + '"> credits';

                materialTableRows.push([
                    '<span onclick="modalOpen(this)">' + material["Name"] + "</span>",
                    grindIndexText,
                    priceText
                ]);
            });

            $('#materialData').DataTable({
                data: materialTableRows,
                columns: [
                    { title: "Name", width: "33%" },
                    { title: "Grind Index", width: "33%" },
                    { title: "Market Price", width: "34%" }
                ],
                columnDefs: [
                    {
                        targets: [1, 2],
                        className: 'dt-body-right',
                    }
                ],
                scrollY: "300px"
            });
        }

        getOreName = function (name) {
            switch (name) {
                case "Ice":
                    return "";
                case "Nhurgite":
                case "Karnite":
                case "Surtrite":
                case "Haderite":
                    return " Crystal";
                default:
                    return " Ore";
            }
        }

        $.each(data.materials, function (index, material) {
            material.recipes = [];
            material.oreName = material.Name + getOreName(material.Name);
            materials[material.Name] = material;
        });

        // Start the request for sadtech, then update mat prices
        $.getJSON("https://api.sadtech.io/api/items", function (data) {
            $.each(data, function (i, marketData) {
                matName = marketData.name.split(" ")[0];
                if (matName in materials) {
                    mData = {
                        CurrentPrice: marketData.currentPrice,
                        StacksAvailable: marketData.currentAvailable
                    }

                    // If there isnt anything on the market, make cost absurdly high so the sort order pushes it to the bottom.
                    if (mData.CurrentPrice <= 0) {
                        materials[matName].MarketPrice = 100000000;
                    }
                    else materials[matName].MarketPrice = mData.CurrentPrice;
                }
            });
            // Only populate after we have our data
            populateMaterialTable();
        });
    });

    $.getJSON('RecipeData.json', function (data) {
        var recipeTableRows = [];

        $.each(data.recipes, function (i, r) {
            // Initialize vars
            var recipe = new Object();
            var researchText = "";
            var materialsText = "";
            var efficiencyText = "";
            var timeText = '';
            recipe["name"] = r.Name;
            recipe["craftingTime"] = r.CraftingTime; //In seconds.
            recipe["materials"] = r.Materials;
            recipe["totalMaterials"] = 0;
            recipe["research"] = r.Research;
            recipe["totalResearch"] = 0;
            recipe["efficiency"] = 0.00;
            recipe["estimatedCost"] = 0.00;
            recipe["totalCrafts"] = { "All": 0, "Cube": 0, "Power": 0, "Gear": 0, "Shield": 0, "Use": 0 };
            recipe["favourite"] = r.Favourite;
            recipe["hide"] = r.Hide;
            recipe["vendorPrice"] = r.VendorPrice;
            recipe["weightedMaterialSpent"] = 0;
            recipe["weightedEfficiency"] = 0;

            // Process object cells.
            $.each(r.Research, function (j, r) {
                researchText += '<p class="leftAlign researchTd inTable">' + j + ":"
                    + "<span class='rightFloat'>" + r + " points</span></p>";
                recipe["totalResearch"] += r;
            });
            $.each(r.Materials, function (materialName, kv) {
                var qtyInStacks = kv / stackConstant;
                materialsText += '<p class="leftAlign materialTd inTable">' + materialName + ":"
                    + "<span class='rightFloat' title='" + kv + "kv'>" + qtyInStacks.toFixed(2) + " stacks</span></p>";
                recipe["totalMaterials"] += kv;
                console.log(materialName);
                recipe["estimatedCost"] += materials[materialName].MarketPrice * qtyInStacks;
                recipe["weightedMaterialSpent"] += materials[materialName]["GrindIndex"] * kv;
                materials[materialName].recipes.push(i); // Cache this recipe for this material
            });

            recipe["efficiency"] = (recipe["totalResearch"] / recipe["totalMaterials"]) * 100;
            recipe["weightedEfficiency"] = (recipe["totalResearch"] / recipe["weightedMaterialSpent"]) * 100;
            efficiencyText = '<p class="leftAlign efficiencyTd inTable"> Base:' + "<span class='rightFloat' title='Research / Total kv consumed'>";
            efficiencyText += recipe["efficiency"].toFixed(2) + "%</span></p>";
            efficiencyText += '<p class="leftAlign efficiencyTd inTable"> Weighted:' + "<span class='rightFloat' title='Research / Total weighted kv consumed'>";
            efficiencyText += recipe["weightedEfficiency"].toFixed(2) + "%</span></p>";

            if (recipe["craftingTime"] == 0) {
                // Subtracting 0.1 to distinguish estimations from actual times.
                recipe["craftingTime"] = Math.ceil(recipe["totalMaterials"] / 100) - 0.1;
                timeText = "<span class='rightFloat' title='Guessed time: "
                    + formatTime(Math.ceil(recipe["craftingTime"])) + "'>"
                    + Math.ceil(recipe["craftingTime"])
                    + '<img src="img/warning.png" alt="Warning: guessed crafting time." width="16" height="14"></span>';
            } else {
                timeText = "<span class='rightFloat' title='" + formatTime(recipe["craftingTime"]) + "'>"
                    + recipe["craftingTime"] + '</span>';
            }

            // Add each object to be displayed.
            recipeTableRows.push([
                '<span onclick="modalOpen(this)">' + recipe["name"] + "</span>",
                timeText,
                efficiencyText,
                nf.format(recipe["estimatedCost"].toFixed(2)) + ' credits',
                researchText,
                materialsText
            ]);
            // Add each object to the array for subsequent queries.
            recipes.push(recipe);
        });

        // Initialize object table as DataTable.
        $('#recipeData').DataTable({
            data: recipeTableRows,
            columns: [
                { title: "Name", width: "28%" },
                { title: "Crafting Time in Seconds", width: "7%" },
                { title: "Efficiency", width: "12%" },
                { title: "Estimated Cost", width: "14%" },
                { title: "Research", width: "17%" },
                { title: "Materials", width: "21%" }
            ],
            columnDefs: [
                {
                    targets: [1, 2],
                    className: 'dt-body-right',
                }
            ],
            scrollY: "300px"
        });
    });
});

// Handle calculation request.
function RunCalculation(hiddenMats) {
    //#region Variable initialization.
    var useableRecipes = [];
    var relevantMaterials = [];
    var maxSingleObjectMatches = $('#maxResults').val();
    var onlyAllResearch = $('#onlyAllResearch').is(":checked");
    var pruneResults = $('#pruneResults').is(":checked");
    var combinedSets = [];
    prioritize = $('#priority').val();

    // Clear previous results.
    $('.deleteMe').remove();
    // Set descending sort order if set by efficiency or vendor price.
    if (prioritize == 'efficiency' || prioritize == 'vendorPrice' || prioritize == 'weightedEfficiency')
        prioritize = '-' + prioritize;
    if (typeof hiddenMats === 'undefined') {
        hiddenMaterials = [];
    }
    //#endregion

    //#region Initialize research targets.
    var cubes = $('#cubeIn').val();
    var powers = $('#powerIn').val();
    var shields = $('#shieldIn').val();
    var gears = $('#gearIn').val();
    var targetResearch = [];
    if (cubes > 0)
        targetResearch['Cube'] = cubes;
    if (powers > 0)
        targetResearch['Power'] = powers;
    if (shields > 0)
        targetResearch['Shield'] = shields;
    if (gears > 0)
        targetResearch['Gear'] = gears;

    // If no research was requested, do nothing.
    if (Object.keys(targetResearch).length == 0)
        return;
    //#endregion

    //#region Find matching objects.
    var distinctResearchQty = Object.keys(targetResearch).length;
    $.each(recipes, function (i, recipe) {
        if (recipe.hide == 1) {
            return; // Object is marked as hidden, skip it.
        }

        // If user requested certain materials be hidden, check object.
        if (typeof hiddenMats !== 'undefined') {
            var objectMaterials = Object.keys(recipe.materials);
            for (var i = 0; i < objectMaterials.length; i++) {
                if (hiddenMats.includes(objectMaterials[i])) {
                    return; // Object uses a material that has been hidden, skip it.
                }
            }
        }

        var objResearchTypesQty = 0;
        $.each(recipe.research, function (name, qty) {
            if (name in targetResearch) {
                objResearchTypesQty++;
                if (objResearchTypesQty == distinctResearchQty || !onlyAllResearch) {
                    useableRecipes.push(recipe);
                    return false; // Break out of the loop since this object is usable.
                }
            }
        });
    });

    if (useableRecipes.length == 0) {
        var text = "No results found";
        if (typeof hiddenMats !== 'undefined') {
            text += "<br>Press Submit to reset"
        }
        // No matching objects found.
        $('#calcTbl').find('tr').find('th').eq(-1)
            .after('<th class="deleteMe">' + text + '</th>');
        return;
    }
    //#endregion

    //#region Calculate how many objects need to be crafted to fulfill all research targets.
    $.each(useableRecipes, function (i, obj) {
        obj.totalCrafts["All"] = 0;
        for (const [key, targetQty] of Object.entries(targetResearch)) {
            if (key in obj.research) {
                var amountPerCraft = obj.research[key];
                var craftsQty = Math.ceil(targetQty / amountPerCraft);
                useableRecipes[i]["totalCrafts"][key] = craftsQty;
                if (!("totalCrafts" in useableRecipes[i]) || useableRecipes[i]["totalCrafts"]["All"] < craftsQty)
                    useableRecipes[i]["totalCrafts"]["All"] = craftsQty;
            }
        }
    });
    //#endregion

    //#region Look for object combinations.
    // Only applies when user requested more than one research type.
    if ((Object.keys(targetResearch).length > 1)) {
        // Try to find combinations that are more efficient than single objects.
        var set = {
            "material": 0,
            "cost": 0,
            "time": 0,
            "objects": [],
            "value": 0,
            "weightedMaterials": 0,
            "weightedEffeciency": 0
        };
        for (var prop in targetResearch) {
            var recipe = getBestMatchSingleResearch(prop, useableRecipes);
            if (recipe == null) {
                break;
            }
            set.material += recipe["totalCrafts"][prop] * recipe["totalMaterials"];
            set.cost += recipe["totalCrafts"][prop] * recipe["estimatedCost"];
            set.time += recipe["totalCrafts"][prop] * recipe["craftingTime"];
            set.value += recipe["totalCrafts"][prop] * recipe["vendorPrice"];
            set.weightedMaterials += recipe["totalCrafts"][prop] * recipe["weightedMaterialSpent"]
            recipe["totalCrafts"]["Use"] = recipe["totalCrafts"][prop];
            set.objects.push(recipe);
            // Add object's materials so they get listed.
            $.each(recipe.materials, function (name, qty) {
                if (!relevantMaterials.includes(name)) {
                    relevantMaterials.push(name);
                }
            });
        }
        // If the set is complete, add it to the results.
        if (Object.keys(targetResearch).length == set.objects.length) {
            combinedSets.push(set);
        }
    }
    //#endregion

    //#region Prepare to display.
    // Sort usable objects by priority.
    useableRecipes.sort(dynamicSort(prioritize));

    // Prune "duplicate results" - objects that provide worse solutions depending on sorting priority.
    var fulfilledResearch = targetResearch;
    var objIndex = 0;
    var deleteIndexes = []

    $.each(useableRecipes, function (i, obj) {
        var usableResearchTypesQty = 0;
        $.each(obj.research, function (name, qty) {
            if (name in fulfilledResearch && fulfilledResearch[name] > 0) {
                usableResearchTypesQty++;
                fulfilledResearch[name] -= obj.totalCrafts["All"] * qty;
            }
        });
        if (usableResearchTypesQty == 0 && pruneResults) {
            // Object is "worthless", a better solution has been found already.
            deleteIndexes.push(objIndex);
        }
        objIndex++;
    });
    var removedItemsCount = 0;
    //console.log(useableObjs);
    for (var i = 0; i < deleteIndexes.length; i++) {
        useableRecipes.splice(deleteIndexes[i] - removedItemsCount, 1);
        removedItemsCount++;
    }
    //console.log(useableObjs);

    // Enforce maxSingleObjectMatches.
    if (useableRecipes.length > maxSingleObjectMatches) {
        useableRecipes.length = maxSingleObjectMatches;
    }

    // Get relevant materials to be displayed.
    $.each(useableRecipes, function (i, obj) {
        $.each(obj.materials, function (name, qty) {
            if (!relevantMaterials.includes(name)) {
                relevantMaterials.push(name);
            }
        });
    });
    // Sort relevant materials to display them in alphabetical order.
    relevantMaterials.sort();

    // Add separator TR/current materials header.
    $('#calcTbl tr:last')
        .after('<tr id="materialsSeparatorRow" class="deleteMe centerAlign">'
            + '<td>Current materials in '
            + '<select id="ownedMatsUOM" onchange="updateOwnedMats()">'
            + '<option value="stacks">stacks</option>'
            + '<option value="volume">volume</option>'
            + '</select>'
            + ' &darr;</td></tr>');
    //#endregion

    //#region Load results into table.
    // Add material "header" rows.
    for (var i = 0; i < relevantMaterials.length; i++) {
        generateResearchMaterialRows(relevantMaterials[i]);
    }
    // Add total material row.
    $('#calcTbl tr:last')
        .after('<tr id="totalMaterialRow" class="deleteMe"><td>Total Material &rarr;</td></tr>');
    $('#calcTbl tr:last')
        .after('<tr id="weightedMaterialRow" class="deleteMe"><td>Total Weighted Material:  &rarr;</td></tr>');

    // Add separator TR.
    $('#calcTbl tr:last')
        .after('<tr id="statsSeparatorRow" class="deleteMe centerAlign"><td>Other Stats</td></tr>');
    // Add 'header' rows for each stat.
    $('#calcTbl tr:last')
        .after('<tr id="efficiencyRow" class="deleteMe"><td>Research/Material Efficiency</td></tr>');
    $('#calcTbl tr:last')
        .after('<tr id="weightedEfficiencyRow" class="deleteMe"><td>Weighted Effeciency</td></tr>');
    $('#calcTbl tr:last')
        .after('<tr id="costRow" class="deleteMe"><td>Material estimated cost</td></tr>');
    $('#calcTbl tr:last')
        .after('<tr id="valueRow" class="deleteMe"><td>Total Vendor Price</td></tr>');
    $('#calcTbl tr:last')
        .after('<tr id="timeRow" class="deleteMe"><td>Crafting Time</td></tr>');


    // Print any combinations found.
    for (var i = 0; i < combinedSets.length; i++) {
        generateColumn(combinedSets[i], i + 2, relevantMaterials);
    }

    // Iterate each usable object to be displayed.
    $.each(useableRecipes, function (i, obj) {
        generateColumn({
            "material": 0,
            "cost": obj.estimatedCost * obj.totalCrafts["All"],
            "time": obj.craftingTime * obj.totalCrafts["All"],
            "objects": [obj],
            "value": obj.vendorPrice * obj.totalCrafts["All"]
        },
            combinedSets.length + i + 2,
            relevantMaterials
        );
    });
    //#endregion
}

function dynamicSort(property, secondary) {
    var sortOrder = 1;
    secondary = (typeof secondary === 'undefined') ? "All" : secondary;
    if (property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a, b) {
        var x = a[property];
        var y = b[property];
        if (property == "estimatedCost" || property == "totalMaterials" || property == "weightedMaterialSpent") {
            x = a[property] * a["totalCrafts"][secondary];
            y = b[property] * b["totalCrafts"][secondary];
        } else if (property == "craftingTime") {
            x = (a[property] == 0 ? 90000 : a[property] * a["totalCrafts"][secondary]);
            y = (b[property] == 0 ? 90000 : b[property] * b["totalCrafts"][secondary]);
        } else if (property == "vendorPrice") {
            x = (a[property] == 0 ? -9000000 : a[property] * a["totalCrafts"][secondary]);
            y = (b[property] == 0 ? -9000000 : b[property] * b["totalCrafts"][secondary]);
        }

        var result = (x < y) ? -1 : (x > y) ? 1 : 0;
        return result * sortOrder;
    }
}

function toggleBgColorByColumn(element) {
    var columnIndex = element.getAttribute("data-index");
    element.classList.toggle("blueBackground");
    $('#calcTbl tr:not(#materialsSeparatorRow, #totalMaterialRow) td:nth-child(' + columnIndex + ')').toggleClass("blueBackground");
}

function toggleBgColorByRow(element) {
    element.parentElement.parentElement.classList.toggle("blueBackground");
}

function updateOwnedMats(element) {
    var ownedMatsUOM = $('#ownedMatsUOM').val();
    var rowsToUpdate = [];
    if (typeof element === 'undefined') {
        $('input[id$="MatCell"]').each(function (i, o) {
            rowsToUpdate.push(o);
        });
    } else {
        rowsToUpdate.push($('#' + element.getAttribute("id")));
    }

    for (var i = 0; i < rowsToUpdate.length; i++) {
        var alreadyOwned = parseFloat($(rowsToUpdate[i]).val());
        if (alreadyOwned == 'NaN') {
            continue;
        }
        if (ownedMatsUOM == 'volume') {
            alreadyOwned = (alreadyOwned / this.stackConstant).toFixed(2);
        }

        var cells = $(rowsToUpdate[i]).closest('tr').find('.updateMe');
        $(cells).each(function (i, o) {
            // update each cell, subtract the new value from rowsToUpdate[i]
            var currentValue = $(o).attr('data-originalVal');
            var newValue = (currentValue - alreadyOwned).toFixed(2);
            newValue = (newValue < 0 ? 0 : newValue) + ' stacks';
            $(o).text(newValue);
        });
    }
}

function getBestMatchSingleResearch(researchType, objectArray) {
    var object = null;
    if (objectArray.length == 0)
        return object;
    objectArray.sort(dynamicSort(prioritize, researchType));
    $.each(objectArray, function (i, obj) {
        if (obj.totalCrafts[researchType] > 0) {
            object = obj;
            return false; // Break the each loop.
        }
    });
    return object;
}

function generateResearchMaterialRows(name) {
    $('#calcTbl tr:last')
        .after('<tr id="' + name + 'Row" class="deleteMe rightAlign">'
            + '<td>'
            + '<span onclick="toggleBgColorByRow(this)">' + name + '</span>'
            + ' <input type="number" step="0.01" value="0" min="0" onclick="this.select();" '
            + ' onblur="updateOwnedMats(this)" id="' + name + 'MatCell">'
            + '<img src="img/hide.png" alt="Hide this material from results." title="Hide this material from results.\nResets on Submit."'
            + 'width="20" height="20" id="' + name + 'Hide" onclick="omitMaterialFromResults(this);">'
            + '</td></tr>');
}

function generateColumn(sets, indexMod, relevantMaterials) {
    addHeaderCell(sets.objects, indexMod);

    // Add total generated points for each research type:
    for (var j = 0; j < researchTypes.length; j++) {
        addResearchCell(researchTypes[j], sets.objects);
    }

    // Add separator row cell.
    $('#materialsSeparatorRow td:last').after('<td>Materials needed &darr;</td>');

    // Calculate and display required materials for each object.
    var totalMaterial = 0;
    var weightedMaterial = 0;
    for (var j = 0; j < relevantMaterials.length; j++) {
        var mat = materials[relevantMaterials[j]];
        var amt = addMaterialCell(relevantMaterials[j], sets.objects);
        totalMaterial += amt;
        weightedMaterial += amt * mat["GrindIndex"];
    }

    // Check if any object has an unknown crafting time to set the warning flag.
    var warn = false;
    $.each(sets.objects, function (i, obj) {
        if (obj.craftingTime % 1 > 0) {
            warn = true;
            return false;
        }
    });

    // Add total materials row.
    var totalInStacks = (totalMaterial / stackConstant).toFixed(2);
    var weightedInStacks = (weightedMaterial / stackConstant).toFixed(2);
    $('#totalMaterialRow').find('td').eq(-1)
        .after('<td title="' + nf.format(totalMaterial) + 'kv" class="rightAlign">'
            + nf.format(totalInStacks) + ' stacks' + '</td>');
    $('#weightedMaterialRow').find('td').eq(-1)
        .after('<td title="' + nf.format(weightedMaterial) + 'kv" class="rightAlign">'
            + nf.format(weightedInStacks) + ' stacks' + '</td>');
    // Add stats separator cell
    $('#statsSeparatorRow td:last').after('<td>-</td>');
    // Add stats cells.
    addStatsCell("efficiency", sets.objects);
    addStatsCell("weightedEfficiency", sets.objects);
    addStatsCell("material", sets.material);
    addStatsCell("cost", sets.cost);
    addStatsCell("value", { "cost": sets.cost, "sell": sets.value });
    addStatsCell("time", sets.time, warn);
}

function addHeaderCell(objects, colIndex) {
    var craftIndex = (objects.length > 1) ? "Use" : "All";
    var headerText = "";
    $.each(objects, function (i, obj) {
        headerText += obj.totalCrafts[craftIndex] + " x " + obj.name + "<br>";
    });
    headerText = headerText.substring(0, headerText.length - 4);
    $('#calcTbl').find('tr').find('th').eq(-1)
        .after('<th class="deleteMe" onclick="toggleBgColorByColumn(this)" '
            + 'data-index="' + (colIndex) + '">' + headerText + '<br></th>');
}

function addStatsCell(cell, value, warn = false) {
    var text = "";
    if (isNaN(value) && (cell == "efficiency" || cell == "weightedEfficiency")) {
        if (value.length == 1) {
            text = nf.format(value[0][cell].toFixed(2)) + '% efficiency';
        } else {
            var efficiencySum = 0;
            for (var i = 0; i < value.length; i++) {
                efficiencySum += value[i][cell];
            }
            text = nf.format((efficiencySum / value.length).toFixed(2)) + "% avg."
        }
    } else if (cell == "cost") {
        text = nf.format(value.toFixed(2)) + ' credits';
    } else if (cell == "time") {
        text = formatTime(value);
    } else if (cell == "value") {
        value.cost
        text = nf.format(value.sell.toFixed(2)) + ' credits'
            + ' (' + nf.format((value.sell - value.cost).toFixed(2))
            + ' ' + ((value.sell - value.cost) < 0 ? 'loss' : 'gain') + ')'
    }

    var warning = '<img src="img/warning.png" alt="Warning: missing crafting time." width="16" height="14">';
    if (warn) {
        text = '<span title="Unknown crafting time detected.">' + text + " " + warning + '</span>';
    }

    $('#' + cell + 'Row').find('td').eq(-1)
        .after('<td class="deleteMe rightAlign">' + text + '</td>');
}

/**
 * Creates research quantity cells for each object/research combination.
 *
 * Calculates the generated research depending on crafting quantities.
 *
 * @param {string}     researchType      The name of the research type row on which the cell should be added.
 * @param {Object[]}   objects           The object array containing all the calculation relevant data.
 */
function addResearchCell(targetResearch, objects) {
    var missingMarker = "";
    var totalPoints = 0;
    var craftIndex = (objects.length > 1) ? "Use" : "All";
    $.each(objects, function (i, obj) {
        var pointsPerCraft = isNaN(obj.research[targetResearch]) ? 0 : obj.research[targetResearch];
        totalPoints += obj.totalCrafts[craftIndex] * pointsPerCraft;
    });
    if ($("#" + targetResearch.toLowerCase() + "In").val() > 0 && totalPoints < 1) {
        missingMarker = " missingRequirement";
    }
    $('#' + targetResearch + 'Row').find('td').eq(-1)
        .after('<td class="deleteMe rightAlign' + missingMarker + '">'
            + nf.format(totalPoints) + ' points</td>');
}

/**
 * Creates material quantity cells for each object/material combination.
 *
 * Calculates the required material depending on crafting quantities.
 *
 * @param {string}     material        The name of the material row on which the new cell should be added.
 * @param {Object[]}   objects         The object array containing all the calculation relevant data.
 *
 * @return {float} Returns the total material calculated so it can be added to the grand total for the object.
 */
function addMaterialCell(material, objects) {
    var craftIndex = (objects.length > 1) ? "Use" : "All";
    var materialSubtotal = 0;
    var craftQty = 0;
    $.each(objects, function (i, obj) {
        var materialQty = (isNaN(obj.materials[material]) ? 0 : obj.materials[material]);
        craftQty = (isNaN(obj.totalCrafts[craftIndex]) ? 0 : obj.totalCrafts[craftIndex]);
        materialSubtotal += materialQty * craftQty;
    });
    materialSubtotal = (isNaN(materialSubtotal) ? 0 : materialSubtotal);
    var subtotalInStacks = (materialSubtotal / stackConstant).toFixed(2);
    var notRequiredMarker = "";
    if (materialSubtotal == 0) {
        notRequiredMarker = " notRequired";
    }

    $('#' + material + 'Row').find('td').eq(-1)
        .after('<td title="' + nf.format(materialSubtotal) + '"'
            + ' class="rightAlign' + notRequiredMarker
            + (subtotalInStacks > 0 ? ' updateMe' : '') + '"'
            + ' data-originalVal="' + subtotalInStacks + '">'
            + nf.format(subtotalInStacks) + ' stacks' + '</td>');
    return materialSubtotal;
}

function omitMaterialFromResults(element) {
    var elementID = element.getAttribute("id");
    var material = elementID.substring(0, elementID.length - 4);
    if (!hiddenMaterials.includes(material))
        hiddenMaterials.push(material);

    RunCalculation(hiddenMaterials);
}

function modalOpen(element) {
    return;
    $('<div></div>').dialog({
        modal: true,
        title: element.innerText,
        buttons: {
            Save: function () {
                var i = $('#modIndex').val();
                var oldName = recipes[i].Name;
                recipes[i].Name = $('#modName').val();
                recipes[i].CraftingTime = $('#modCTime').val();
                recipes[i].Favourite = $('#modFav').val();
                recipes[i].Hide = $('#modHide').val();
                $('.modRes').each(function (j, e) {
                    var researchName = $(e).attr('id').substring(3);
                    recipes[i].Research[researchName] = $(e).val();
                });

                $('.modMat').each(function (j, e) {
                    var materialName = $(e).attr('id').substring(3);
                    recipes[i].Materials[materialName] = $(e).val();
                });

                // Save to file
                $.post({
                    url: "json.php",
                    data: { info: recipes }
                }).done(function (response) {
                    var parsed = JSON.parse(response);
                    console.log(response);
                    console.log(parsed);
                    console.log('ajax done');
                });
                $(this).dialog("close");
            },
            Cancel: function () {
                $(this).dialog("close");
            }
        },
        closeOnEscape: true,
        show: true,
        height: 400,
        width: 450,
        open: function () {
            var objName = element.innerText;
            var obj = null;
            var index = null;
            $.each(recipes, function (i, r) {
                if (r["Name"] == objName) {
                    obj = r;
                    index = i;
                }
            });
            if (obj == null) {
                console.log('Object not found: ' + objName);
                return;
            }
            var indexTag = '<input type="hidden" class="modVals" id="modIndex" value="' + index + '">'
            var name = '<label for="modName">Name: </label>'
                + '<input type="text" class="modVals" id="modName" value="' + objName + '"><br>';
            var cTime = '<label for="modName">Crafting Time: </label>'
                + '<input type="text" id="modCTime" value="' + obj["CraftingTime"] + '"><br>';
            var fav = '<label for="modFav">Favourite: </label>'
                + '<input type="text" id="modFav" value="' + obj["Favourite"] + '"><br>';
            var hide = '<label for="modHide">Hidden: </label>'
                + '<input type="text" id="modHide" value="' + obj["Hide"] + '"><br>';
            // Iterate Research
            var research = "<span>Research</span><br>";
            $.each(obj.Research, function (i, r) {
                research += '<label for="mod' + i + '">' + i + ': </label>'
                    + '<input type="text" class="modRes" id="mod' + i + '" value="' + r + '"><br>';
            });
            // Iterate Materials
            var materials = "<span>Materials</span><br>";
            $.each(obj.Materials, function (i, m) {
                materials += '<label for="mod' + i + '">' + i + ': </label>'
                    + '<input type="text" class="modMat" id="mod' + i + '" value="' + m + '"><br>';
            });
            // Add Materials
            var markup = indexTag + name + cTime + fav + hide + research + materials;
            $(this).html(markup);
        }
    }); // End dialog.
}

function formatTime(seconds) {
    if (isNaN(seconds))
        return 0;

    // Under half a minute, return in seconds.
    if (seconds < 31)
        return seconds.toFixed(2) + ' secs.';

    // Over 1.5 hours, return in hours.
    var time = (seconds / 60).toFixed(2);
    if (time > 90) {
        time = nf.format((time / 60).toFixed(2));
        return time + ' hrs.';
    }

    // Between 31 seconds and 90 minutes, retun in minutes.
    return nf.format(time) + ' mins.';
}

function updateMaterialGrindIndex(element) {
    var value = parseFloat(element.value);
    if (value == 'NaN') {
        element.value = materials[element.id]["GrindIndex"];
        return;
    }
    materials[element.id]["GrindIndex"] = value;
    updateMaterialData(element.id);
}
function updateMaterialMarketPrice(element) {
    var value = parseFloat(element.value);
    if (value == 'NaN') {
        element.value = materials[element.id].MarketPrice;
        return;
    }
    materials[element.id].MarketPrice = value.toFixed(2);
    updateMaterialData(element.id);
}
function updateMaterialData(materialName) {
    // For each recipe using the material
    $.each(materials[materialName].recipes, function (index, recipeId) {
        recipe = recipes[recipeId];
        recipe["estimatedCost"] = 0;
        recipe["weightedMaterialSpent"] = 0;
        // for each material in that recipe
        $.each(recipe.materials, function (mat, amt) {
            var qtyInStacks = amt / stackConstant;
            recipe["estimatedCost"] += materials[mat].MarketPrice * qtyInStacks;
            recipe["weightedMaterialSpent"] += materials[mat].GrindIndex * amt;
        });
        recipe["weightedEfficiency"] = (recipe["totalResearch"] / recipe["weightedMaterialSpent"]) * 100;
    });
};