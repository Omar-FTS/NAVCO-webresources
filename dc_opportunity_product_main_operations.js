var NavcoOpportunityLineSdk = window.NavcoOpportunityLineSdk || {};
(function () {

    // ================================
    // Event Handlers (public)
    // ================================

    // Form OnLoad
    this.formOnLoad = function (executionContext) {
        const formContext = executionContext.getFormContext();
        showHideQuantityValues(formContext);

        // If a product is already selected on load, apply margins & defaults
        const productAttr = formContext.getAttribute("dc_productid");
        if (productAttr && productAttr.getValue()) {
            SetMarginsAndDefaults(executionContext);
        }
    };

    // dc_productid OnChange
    this.onDC_ProductChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        showHideQuantityValuesInOnChange(executionContext);
    };

    // dc_specialproduct OnChange
    this.onSpecialProductChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        toggleSpecialProductMargin(executionContext);
    };

    // dc_marginrate OnChange
    this.onMarginRateChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
    };

    // dc_monthlyquantity OnChange
    // TODO: Add contract-length-based quantity calculation here if confirmed applicable to opportunity products.
    this.onMonthlyQuantityChange = function (_executionContext) {
        // placeholder — no contract-length calculation on opportunity products yet
    };

    // ================================
    // Core Logic
    // ================================

    function SetMarginsAndDefaults(executionContext) {

        var formContext = executionContext.getFormContext();

        var productAttr = formContext.getAttribute("dc_productid");
        if (!productAttr || !productAttr.getValue()) return;

        // Per formula: set isproductoverridden = false, hide productdescription & productid
        formContext.getAttribute("isproductoverridden")?.setValue(false);
        formContext.getControl("productdescription")?.setVisible(false);
        formContext.getAttribute("productdescription")?.setRequiredLevel("none");
        formContext.getControl("productid")?.setVisible(false);
        formContext.getAttribute("productid")?.setRequiredLevel("none");

        var specialProductAttr = formContext.getAttribute("dc_specialproduct");
        var monthlyQtyAttr = formContext.getAttribute("dc_monthlyquantity");
        var marginAttr = formContext.getAttribute("dc_marginrate");

        // Resolve parent opportunity lookup
        var oppLookup = getLookupValue(formContext, "opportunityid");
        if (!oppLookup) return;

        // Retrieve margin defaults from the opportunity
        Xrm.WebApi.retrieveRecord(
            oppLookup.entityType,
            oppLookup.id,
            "?$select=dc_standardproductmargin,dc_specialproductmargin,dc_outsidelabormargin,dc_subscriptionproductmargin"
        ).then(function (opportunity) {

            var standardMargin      = opportunity.dc_standardproductmargin;
            var specialMargin       = opportunity.dc_specialproductmargin;
            var outsideLaborMargin  = opportunity.dc_outsidelabormargin;
            var subscriptionMargin  = opportunity.dc_subscriptionproductmargin;

            // Resolve product family from parent product number
            getProductFamily(productAttr.getValue()[0].id)
                .then(function (productFamily) {

                    var calculatedMargin = null;

                    switch (productFamily) {

                        case "MATERIAL_FAMILY":
                            showField(formContext, "dc_specialproduct");
                            hideAndClearField(formContext, "dc_monthlyquantity");

                            if (specialProductAttr && specialProductAttr.getValue() === true) {
                                calculatedMargin = specialMargin;
                            } else {
                                calculatedMargin = standardMargin;
                            }
                            break;

                        case "OUTSIDELABOR_FAMILY":
                            hideAndClearField(formContext, "dc_monthlyquantity");
                            hideField(formContext, "dc_specialproduct");
                            calculatedMargin = outsideLaborMargin;
                            break;

                        case "MONITORING_FAMILY":
                            hideField(formContext, "dc_specialproduct");
                            showField(formContext, "dc_monthlyquantity");

                            if (monthlyQtyAttr) {
                                monthlyQtyAttr.setValue(1);
                                monthlyQtyAttr.setRequiredLevel("required");
                                formContext.getControl("dc_monthlyquantity")?.setDisabled(true);
                            }

                            calculatedMargin = subscriptionMargin;
                            break;

                        case "SUBSCRIPTION_FAMILY":
                            showField(formContext, "dc_monthlyquantity");
                            setRequired(formContext, "dc_monthlyquantity");
                            hideField(formContext, "dc_specialproduct");
                            calculatedMargin = subscriptionMargin;
                            break;

                        case "SERVICE_FAMILY":
                            hideAndClearField(formContext, "dc_monthlyquantity");
                            hideField(formContext, "dc_specialproduct");
                            calculatedMargin = outsideLaborMargin;
                            break;
                    }

                    // Only populate dc_marginrate when it is currently empty
                    if (marginAttr && !marginAttr.getValue() && calculatedMargin !== null) {
                        marginAttr.setValue(calculatedMargin);
                    }

                    // TODO (from N52 formula — commented-out section):
                    // iftrue(DoesNotContainData([opportunityproduct.dc_marginrate]),
                    //   SetClientSideField('dc_manualmargin', 0)
                    // )
                    // iftrue(ContainsData(linemarginrate) && linemarginrate != marginrate,
                    //   SetClientSideField('dc_marginrate', marginrate)   <-- truncated; implement when confirmed
                    // )

                });

        }).catch(function (error) {
            console.error("Navco: Error retrieving opportunity margins.", error.message);
        });
    }

    async function toggleSpecialProductMargin(executionContext) {
        const formContext = executionContext.getFormContext();

        const oppLookup = getLookupValue(formContext, "opportunityid");
        if (!oppLookup) return;

        const productAttr = formContext.getAttribute("dc_productid");
        const marginAttr  = formContext.getAttribute("dc_marginrate");

        if (!productAttr || !productAttr.getValue() || !marginAttr) return;

        try {
            // Retrieve standard and special margins from the opportunity
            const opportunity = await Xrm.WebApi.retrieveRecord(
                oppLookup.entityType,
                oppLookup.id,
                "?$select=dc_standardproductmargin,dc_specialproductmargin"
            );

            const standardProductMargin = opportunity.dc_standardproductmargin;
            const specialProductMargin  = opportunity.dc_specialproductmargin;

            // Only relevant for MATERIAL_FAMILY
            const productId     = productAttr.getValue()[0].id.replace("{", "").replace("}", "");
            const productFamily = await getProductFamily(productId);

            if (productFamily === "MATERIAL_FAMILY") {
                const specialProductAttr = formContext.getAttribute("dc_specialproduct");

                let marginRate = (specialProductAttr && specialProductAttr.getValue() === true)
                    ? specialProductMargin
                    : standardProductMargin;

                // Always overwrite — toggle is an explicit user action
                if (marginRate !== null && marginRate !== undefined) {
                    marginAttr.setValue(marginRate);
                }
            }

        } catch (error) {
            console.error("Navco: Error toggling special product margin.", error.message);
        }
    }

    async function showHideQuantityValuesInOnChange(executionContext) {
        const formContext = executionContext.getFormContext();
        showHideQuantityValues(formContext);
    }

    async function showHideQuantityValues(formContext) {

        const productAttr = formContext.getAttribute("dc_productid");

        if (!productAttr || !productAttr.getValue()) {
            hideField(formContext, "dc_monthlyquantity");
            return;
        }

        const productId = productAttr.getValue()[0].id.replace("{", "").replace("}", "");

        try {
            const productFamily = await getProductFamily(productId);

            if (!productFamily) {
                hideField(formContext, "dc_monthlyquantity");
                return;
            }

            if (productFamily === "MATERIAL_FAMILY") {
                showField(formContext, "dc_specialproduct");
            } else {
                hideField(formContext, "dc_specialproduct");
            }

            if (
                productFamily === "MATERIAL_FAMILY" ||
                productFamily === "SERVICE_FAMILY"  ||
                productFamily === "OUTSIDELABOR_FAMILY"
            ) {
                showField(formContext, "quantity");
                hideField(formContext, "dc_monthlyquantity");
            } else {
                showField(formContext, "dc_monthlyquantity");
                hideField(formContext, "quantity");
            }

        } catch (error) {
            console.error("Navco: Error showing/hiding quantity values.", error.message);
            hideField(formContext, "dc_monthlyquantity");
        }
    }

    // ================================
    // Private Helpers
    // ================================

    function getLookupValue(formContext, fieldName) {
        var attr = formContext.getAttribute(fieldName);
        if (!attr || !attr.getValue()) return null;

        return {
            id:         attr.getValue()[0].id.replace("{", "").replace("}", ""),
            entityType: attr.getValue()[0].entityType
        };
    }

    function getProductFamily(productId) {

        productId = productId.replace("{", "").replace("}", "");

        return Xrm.WebApi.retrieveRecord(
            "product",
            productId,
            "?$select=parentproductid&$expand=parentproductid($select=productnumber)"
        ).then(function (result) {

            if (result.parentproductid && result.parentproductid.productnumber) {
                return result.parentproductid.productnumber.toUpperCase();
            }

            return null;
        });
    }

    function showField(formContext, fieldName) {
        var control = formContext.getControl(fieldName);
        if (control) control.setVisible(true);
    }

    function hideField(formContext, fieldName) {
        var control = formContext.getControl(fieldName);
        if (control) control.setVisible(false);

        var attr = formContext.getAttribute(fieldName);
        if (attr) attr.setRequiredLevel("none");
    }

    function hideAndClearField(formContext, fieldName) {
        hideField(formContext, fieldName);

        var attr = formContext.getAttribute(fieldName);
        if (attr) {
            attr.setValue(null);
            attr.setRequiredLevel("none");
        }
    }

    function setRequired(formContext, fieldName) {
        var attr = formContext.getAttribute(fieldName);
        if (attr) attr.setRequiredLevel("required");
    }

}).call(NavcoOpportunityLineSdk);
