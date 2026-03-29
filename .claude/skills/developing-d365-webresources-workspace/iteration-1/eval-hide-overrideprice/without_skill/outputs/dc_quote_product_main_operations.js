var NavcoQuoteLineSdk = window.NavcoQuoteLineSdk || {};
(function () {

    // Code to run in the form OnLoad event
    this.formOnLoad = function (executionContext) {
        const formContext = executionContext.getFormContext()
        lockFormWhenRelatedQuoteIsPendingApproval(formContext);
        lockFormWhenRelatedQuoteIsWonOrLost(formContext);
        setCostOverrideDescriptionRequired(executionContext);
        filterProducts(executionContext);
        SetMarginsAndDefaults(executionContext);
        toggleOverridePriceVisibility(formContext);
    }

    this.onParentFilterChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        productFamilyValidation(executionContext);
        filterProducts(executionContext);
    }

    this.onTypeFilterChange = function (executionContext) {
        filterProducts(executionContext);
    }

    this.onDC_ProductChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        productFamilyValidation(executionContext);
        setHiddenProductField(executionContext);
    }

    this.onQuantityChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
    }

    this.onSpecialProductChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        toggleSpecialProductMargin(executionContext);
    }
    this.onMarginRateChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
    }
    this.onPriceOverrideChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
    }

    this.onCostOverrideChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        setCostOverrideDescriptionRequired(executionContext);
    }

    this.selectedsearchproductidOnChange = function (executionContext) {
        updateProductFromSearchControl(executionContext);
    }

    // check if given control is an ifrmae, webresource or a subgrid.
    function doesControlHaveAttribute(control) {
        var controlType = control.getControlType();
        return controlType != "iframe" && controlType != "webresource" && controlType != "subgrid";
    }

    // Toggle visibility of dc_overrideprice based on quote statecode
    async function toggleOverridePriceVisibility(formContext) {
        var quoteRef = formContext.getAttribute("quoteid").getValue();
        if (!quoteRef || quoteRef.length === 0) return;

        var quoteId = quoteRef[0].id.replace("{", "").replace("}", "");

        try {
            var result = await Xrm.WebApi.retrieveRecord("quote", quoteId, "?$select=statecode");
            var isWon = result.statecode === 3;
            formContext.getControl("dc_overrideprice").setVisible(!isWon);
        } catch (e) {
            console.error(e.message);
        }
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
                control.setDisabled(true);
            }
        });

        forceDisablePriceFields(formContext);

    }

    function forceDisablePriceFields(formContext) {

        setTimeout(function () {
            formContext.getControl("priceperunit")?.setDisabled(true);
            formContext.getControl("ispriceoverridden")?.setDisabled(true);
        }, 1500);
    }

    function SetMarginsAndDefaults(executionContext) {

        var formContext = executionContext.getFormContext();

        var productAttr = formContext.getAttribute("dc_productid");
        if (!productAttr || !productAttr.getValue()) return;

        var specialProductAttr = formContext.getAttribute("dc_specialproduct");
        var marginAttr = formContext.getAttribute("dc_marginrate");

        var quoteLookup =
            getLookupValue(formContext, "dc_quoteid") ||
            getLookupValue(formContext, "quoteid");

        if (!quoteLookup) return;

        Xrm.WebApi.retrieveRecord(
            quoteLookup.entityType,
            quoteLookup.id,
            "?$select=dc_standardproductmargin,dc_specialproductmargin,dc_outsidelabormargin,dc_subscriptionproductmargin"
        ).then(function (quote) {

            var standardMargin = quote.dc_standardproductmargin;
            var specialMargin = quote.dc_specialproductmargin;
            var outsideLaborMargin = quote.dc_outsidelabormargin;
            var subscriptionMargin = quote.dc_subscriptionproductmargin;

            getProductFamily(productAttr.getValue()[0].id)
                .then(function (productFamily) {

                    var calculatedMargin = null;

                    switch (productFamily) {

                        case "MATERIAL_FAMILY":
                            showField(formContext, "dc_specialproduct");

                            if (specialProductAttr && specialProductAttr.getValue() === true) {
                                calculatedMargin = specialMargin;
                            } else {
                                calculatedMargin = standardMargin;
                            }
                            break;

                        case "OUTSIDELABOR_FAMILY":
                            hideField(formContext, "dc_specialproduct");
                            calculatedMargin = outsideLaborMargin;
                            break;

                        case "MONITORING_FAMILY":
                            hideField(formContext, "dc_specialproduct");
                            calculatedMargin = subscriptionMargin;
                            break;

                        case "SUBSCRIPTION_FAMILY":
                            hideField(formContext, "dc_specialproduct");
                            calculatedMargin = subscriptionMargin;
                            break;

                        case "SERVICE_FAMILY":
                            hideField(formContext, "dc_specialproduct");
                            calculatedMargin = outsideLaborMargin;
                            break;
                    }

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

    async function productFamilyValidation(executionContext) {

        const formContext = executionContext.getFormContext();
        const BOX_SALE_MODEL = 948170001;
        const STANDARD_MODEL = 948170000;

        const quoteLookup = getLookupValue(formContext, "dc_quoteid");

        if (!quoteLookup) return;

        try {
            const quote = await Xrm.WebApi.retrieveRecord(
                quoteLookup.entityType,
                quoteLookup.id,
                "?$select=dc_quotemodel"
            );

            const quoteModel = quote.dc_quotemodel;

            if (quoteModel === BOX_SALE_MODEL) {
                await validateParentFilter(formContext, ["MATERIAL_FAMILY"], "Only Material product family is allowed for Box Sale quotes.");
                await validateProduct(formContext, ["MATERIAL_FAMILY"], "Only Material products are allowed for Box Sale quotes!");
            } else if (quoteModel === STANDARD_MODEL) {
                await validateParentFilter(formContext, ["MATERIAL_FAMILY", "OUTSIDELABOR_FAMILY"], "Only Material or Outside Labor product families are allowed for Standard Model quotes.");
                await validateProduct(formContext, ["MATERIAL_FAMILY", "OUTSIDELABOR_FAMILY"], "Only Material or Outside Labor products are allowed for Standard Model quotes!");
            } else {
                formContext.getControl("dc_parentfilterid")?.clearNotification("boxsale_parent");
                formContext.getControl("dc_productid")?.clearNotification("boxsale_product");
            }

        } catch (error) {
            console.error("Navco: Error validating product family rule.", error.message);
        }
    }

    async function validateParentFilter(formContext, allowedFamilies, errorMessage) {
        const parentFilterAttr = formContext.getAttribute("dc_parentfilterid");
        if (!parentFilterAttr || !parentFilterAttr.getValue()) { formContext.getControl("dc_parentfilterid")?.clearNotification("boxsale_parent"); return; }
        const parentFilterId = parentFilterAttr.getValue()[0].id.replace("{", "").replace("}", "");
        try {
            const product = await Xrm.WebApi.retrieveRecord("product", parentFilterId, "?$select=productnumber");
            if (!allowedFamilies.includes(product.productnumber)) { formContext.getControl("dc_parentfilterid").setNotification(errorMessage, "boxsale_parent"); }
            else { formContext.getControl("dc_parentfilterid").clearNotification("boxsale_parent"); }
        } catch (error) { console.error("Navco: Error validating parent filter.", error.message); }
    }

    async function validateProduct(formContext, allowedFamilies, errorMessage) {
        const productAttr = formContext.getAttribute("dc_productid");
        if (!productAttr || !productAttr.getValue()) { formContext.getControl("dc_productid")?.clearNotification("boxsale_product"); return; }
        const productId = productAttr.getValue()[0].id.replace("{", "").replace("}", "");
        try {
            const product = await Xrm.WebApi.retrieveRecord("product", productId, "?$select=parentproductid&$expand=parentproductid($select=productnumber)");
            if (product.parentproductid && !allowedFamilies.includes(product.parentproductid.productnumber)) { formContext.getControl("dc_productid").setNotification(errorMessage, "boxsale_product"); }
            else { formContext.getControl("dc_productid").clearNotification("boxsale_product"); }
        } catch (error) { console.error("Navco: Error validating product.", error.message); }
    }

    async function updateProductFromSearchControl(executionContext) {
        const formContext = executionContext.getFormContext();
        const selectedSearchProductAttr = formContext.getAttribute("dc_selectedsearchproductid");
        if (!selectedSearchProductAttr || !selectedSearchProductAttr.getValue()) return;
        let selectedProductId = selectedSearchProductAttr.getValue();
        try {
            const product = await Xrm.WebApi.retrieveRecord("product", selectedProductId, "?$select=name");
            const lookupValue = [{ id: selectedProductId, name: product.name, entityType: "product" }];
            const dcProductIdAttr = formContext.getAttribute("dc_productid");
            if (dcProductIdAttr) { dcProductIdAttr.setValue(lookupValue); dcProductIdAttr.fireOnChange(); }
            const productIdAttr = formContext.getAttribute("productid");
            if (productIdAttr) { productIdAttr.setValue(lookupValue); productIdAttr.fireOnChange(); }
        } catch (error) { console.error("Navco: Error updating product from search control.", error.message); }
    }

    function setHiddenProductField(executionContext) {
        const formContext = executionContext.getFormContext();
        const dcProductIdAttr = formContext.getAttribute("dc_productid");
        if (dcProductIdAttr && dcProductIdAttr.getValue()) {
            const dcProductValue = dcProductIdAttr.getValue()[0];
            const lookupValue = [{ id: dcProductValue.id, name: dcProductValue.name, entityType: "product" }];
            const productIdAttr = formContext.getAttribute("productid");
            if (productIdAttr) { productIdAttr.setValue(lookupValue); productIdAttr.fireOnChange(); }
        } else {
            const productIdAttr = formContext.getAttribute("productid");
            if (productIdAttr) productIdAttr.setValue(null);
        }
    }

    function setCostOverrideDescriptionRequired(executionContext) {
        const formContext = executionContext.getFormContext();
        const costOverrideAttr = formContext.getAttribute("dc_costoverride");
        const overrideDescriptionAttr = formContext.getAttribute("dc_overridedescription");
        if (!overrideDescriptionAttr) return;
        if (costOverrideAttr && costOverrideAttr.getValue() != null) {
            overrideDescriptionAttr.setRequiredLevel("required");
        } else {
            overrideDescriptionAttr.setRequiredLevel("none");
        }
    }

    async function toggleSpecialProductMargin(executionContext) {
        const formContext = executionContext.getFormContext();
        const quoteLookup = getLookupValue(formContext, "dc_quoteid") || getLookupValue(formContext, "quoteid");
        if (!quoteLookup) return;
        const productAttr = formContext.getAttribute("dc_productid");
        const marginAttr = formContext.getAttribute("dc_marginrate");
        if (!productAttr || !productAttr.getValue() || !marginAttr) return;
        try {
            const quote = await Xrm.WebApi.retrieveRecord(quoteLookup.entityType, quoteLookup.id, "?$select=dc_standardproductmargin,dc_specialproductmargin");
            const productId = productAttr.getValue()[0].id.replace("{", "").replace("}", "");
            const productFamily = await getProductFamily(productId);
            let marginRate = null;
            if (productFamily === "MATERIAL_FAMILY") {
                const specialProductAttr = formContext.getAttribute("dc_specialproduct");
                marginRate = (specialProductAttr && specialProductAttr.getValue() === true) ? quote.dc_specialproductmargin : quote.dc_standardproductmargin;
            }
            if (marginRate !== null) marginAttr.setValue(marginRate);
        } catch (error) { console.error("Navco: Error toggling special product margin.", error.message); }
    }

    function filterProducts(executionContext) {
        const formContext = executionContext.getFormContext();
        const parentFilterAttr = formContext.getAttribute("dc_parentfilterid");
        const itemTypeAttr = formContext.getAttribute("dc_itemtype");
        if (!parentFilterAttr || !parentFilterAttr.getValue() || !itemTypeAttr || !itemTypeAttr.getValue()) return;
        try {
            const parentFilterId = parentFilterAttr.getValue()[0].id.replace("{", "").replace("}", "");
            const itemType = itemTypeAttr.getValue();
            const productControl = formContext.getControl("dc_productid");
            if (!productControl) { console.warn("Navco: Product control not found."); return; }
            productControl.addCustomView("{00000000-0000-0000-0000-000000000001}", "product", "FilteredProducts", formatFetchXmlForProductFilter(parentFilterId, itemType), getProductFilterLayoutXml(), true);
        } catch (error) { console.error("Navco: Error filtering products.", error.message); }
    }

    function formatFetchXmlForProductFilter(parentFilterId, itemType) {
        return `<fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
            <entity name="product">
                <attribute name="name" /><attribute name="productid" /><attribute name="dc_manufacturerid" /><attribute name="standardcost" /><attribute name="price" /><attribute name="dc_shortdescription" />
                <filter type="and"><condition attribute="parentproductid" operator="eq" value="${parentFilterId}" /><condition attribute="statecode" operator="eq" value="0" /></filter>
                <link-entity name="dc_productcategory" from="dc_productcategoryid" to="dc_productcategoryid" link-type="inner" alias="ad"><filter type="and"><condition attribute="dc_itemtype" operator="eq" value="${itemType}" /></filter></link-entity>
            </entity></fetch>`;
    }

    function getProductFilterLayoutXml() {
        return `<grid name="resultset" object="1024" jump="name" select="1" icon="1" preview="1"><row name="result" id="productid"><cell name="name" width="200" /><cell name="dc_manufacturerid" width="150" /><cell name="dc_shortdescription" width="150" /><cell name="standardcost" width="150" /><cell name="price" width="100" /></row></grid>`;
    }

}).call(NavcoQuoteLineSdk)
