var Navco = window.Navco || {};
(function () {

    // Code to run in the form OnLoad event
    this.formOnLoad = function (executionContext) {
        const formContext = executionContext.getFormContext()
        lockFormWhenRelatedQuoteIsPendingApproval(formContext);
        lockFormWhenRelatedQuoteIsWonOrLost(formContext);
    }

    // check if given control is an ifrmae, webresource or a subgrid.
    function doesControlHaveAttribute(control) {
        var controlType = control.getControlType();
        return controlType != "iframe" && controlType != "webresource" && controlType != "subgrid";
    }

    async function lockFormWhenRelatedQuoteIsWonOrLost(formContext) {

        const relatedQuoteId = formContext.getAttribute("quoteid").getValue()[0].id.slice(1, -1)

        const globalContext = Xrm.Utility.getGlobalContext();
        const clientUrl = globalContext.getClientUrl();

        const fieldsToSkip = ['dc_recostingsequencenumber']

        const result = await fetch(`${clientUrl}/api/data/v9.2/quotes(${relatedQuoteId})?$select=statecode`)
            .then(response => response.json())

        // quote is active or won or lost
        if (result.statecode === 1 || result.statecode === 2 || result.statecode === 3) {
            formContext.ui.controls.forEach(function (control, _) {
                if (doesControlHaveAttribute(control) && !fieldsToSkip.includes(control.getAttribute().getName())) {
                    control.setDisabled(true);
                }
            });
        }

    }

    function lockFormWhenRelatedQuoteIsPendingApproval(formContext) {

        const PENDING_APPROVAL_STATUS = 948170001;
        const FORM_NOTIFICATION_ID = "lockedquote";
        const ERROR_MESSAGE = "Cannot edit lines on a quote pending approval.";

        const quoteAttr = formContext.getAttribute("dc_quoteid");

        if (!quoteAttr || !quoteAttr.getValue()) {
            return;
        }

        const quoteId = quoteAttr.getValue()[0].id.replace("{", "").replace("}", "");

        Xrm.WebApi.retrieveRecord("quote", quoteId, "?$select=statuscode")
            .then(
                function (result) {
                    if (result.statuscode === PENDING_APPROVAL_STATUS) {
                        applyPendingApprovalLock(formContext, ERROR_MESSAGE, FORM_NOTIFICATION_ID);
                    }
                },
                function (error) {
                    console.error("Navco: Failed to retrieve Quote status.", error.message);
                }
            );
    }

    function applyPendingApprovalLock(formContext, message, notificationId) {

        // Form notification
        formContext.ui.setFormNotification(
            message,
            "ERROR",
            notificationId
        );

        // Disable ALL controls that support setDisabled
        formContext.ui.controls.forEach(function (control) {

            if (control && control.setDisabled) {
                // Optional: skip controls you don’t want locked
                // if (control.getName() === "dc_quoteid") return;
                control.setDisabled(true);
            }
        });
        
        forceDisablePriceFields(formContext);

    }
    function forceDisablePriceFields(formContext) {

        setTimeout(function () {
            formContext.getControl("priceperunit")?.setDisabled(true);
            formContext.getControl("ispriceoverridden")?.setDisabled(true);
        }, 1500); // 1 second delay
    }

    this.SetMarginsAndDefaults = function (executionContext) {

        debugger;
        var formContext = executionContext.getFormContext();

        var productAttr = formContext.getAttribute("dc_productid");
        if (!productAttr || !productAttr.getValue()) return;

        var specialProductAttr = formContext.getAttribute("dc_specialproduct");
        var monthlyQtyAttr = formContext.getAttribute("dc_monthlyquantity");
        var marginAttr = formContext.getAttribute("dc_marginrate");

        // Get Quote Lookup (dc_quoteid first, fallback to quoteid)
        var quoteLookup =
            getLookupValue(formContext, "dc_quoteid") ||
            getLookupValue(formContext, "quoteid");

        if (!quoteLookup) return;

        // Get quote margins from lookup entity
        Xrm.WebApi.retrieveRecord(
            quoteLookup.entityType,
            quoteLookup.id,
            "?$select=dc_standardproductmargin,dc_specialproductmargin,dc_outsidelabormargin,dc_subscriptionproductmargin"
        ).then(function (quote) {

            var standardMargin = quote.dc_standardproductmargin;
            var specialMargin = quote.dc_specialproductmargin;
            var outsideLaborMargin = quote.dc_outsidelabormargin;
            var subscriptionMargin = quote.dc_subscriptionproductmargin;

            // Get Product Family
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
                                formContext.getControl("dc_monthlyquantity").setDisabled(true);
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

                    // Only set margin if empty (do not overwrite manual entry)
                    if (marginAttr && !marginAttr.getValue() && calculatedMargin !== null) {
                        marginAttr.setValue(calculatedMargin);
                    }

                });

        }).catch(function (error) {
            console.error("Error retrieving quote margins:", error.message);
        });
    }

    function getLookupValue(formContext, fieldName) {
        var attr = formContext.getAttribute(fieldName);
        if (!attr || !attr.getValue()) return null;

        return {
            id: attr.getValue()[0].id.replace("{", "").replace("}", ""),
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
}).call(Navco)