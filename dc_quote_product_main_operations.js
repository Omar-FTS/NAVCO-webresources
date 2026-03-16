var NavcoQuoteLineSdk = window.NavcoQuoteLineSdk || {};
(function () {

    // Code to run in the form OnLoad event
    this.formOnLoad = function (executionContext) {
        const formContext = executionContext.getFormContext()
        lockFormWhenRelatedQuoteIsPendingApproval(formContext);
        lockFormWhenRelatedQuoteIsWonOrLost(formContext);
        setCostOverrideDescriptionRequired(formContext);
        showHideQuantityValues(formContext);
        filterProducts(executionContext);
    }

    this.onParentFilterChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        productFamilyValidation(executionContext);
        showHideQuantityValuesInOnChange(executionContext);
        filterProducts(executionContext);
    }

    this.onTypeFilterChange = function (executionContext) {
        filterProducts(executionContext);
    }

    this.onDC_ProductChange = function (executionContext) {
        SetMarginsAndDefaults(executionContext);
        productFamilyValidation(executionContext);
        setHiddenProductField(executionContext);
        showHideQuantityValuesInOnChange(executionContext);
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
        setCostOverrideDescriptionRequiredInOnChange(executionContext);
    }

    this.onMonthlyQuantityChange = function (executionContext) {
        calculateQuantityFromMonthlyAndContract(executionContext);
    }

    this.selectedsearchproductidOnChange = function (executionContext) {
        updateProductFromSearchControl(executionContext);
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
                // Optional: skip controls you donâ€™t want locked
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

    function SetMarginsAndDefaults(executionContext) {

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

    // Quote Model Product Family Validation
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
                // Box Sale: Material family only
                await validateParentFilter(formContext,
                    ["MATERIAL_FAMILY"],
                    "Only Material product family is allowed for Box Sale quotes."
                );
                await validateProduct(formContext,
                    ["MATERIAL_FAMILY"],
                    "Only Material products are allowed for Box Sale quotes!"
                );
            } else if (quoteModel === STANDARD_MODEL) {
                // Standard Model: Material or Outside Labor families
                await validateParentFilter(formContext,
                    ["MATERIAL_FAMILY", "OUTSIDELABOR_FAMILY"],
                    "Only Material or Outside Labor product families are allowed for Standard Model quotes."
                );
                await validateProduct(formContext,
                    ["MATERIAL_FAMILY", "OUTSIDELABOR_FAMILY"],
                    "Only Material or Outside Labor products are allowed for Standard Model quotes!"
                );
            } else {
                // Other models: clear any existing notifications
                formContext.getControl("dc_parentfilterid")?.clearNotification("boxsale_parent");
                formContext.getControl("dc_productid")?.clearNotification("boxsale_product");
            }

        } catch (error) {
            console.error("Navco: Error validating product family rule.", error.message);
        }
    }

    async function validateParentFilter(formContext, allowedFamilies, errorMessage) {
        const parentFilterAttr = formContext.getAttribute("dc_parentfilterid");

        if (!parentFilterAttr || !parentFilterAttr.getValue()) {
            formContext.getControl("dc_parentfilterid")?.clearNotification("boxsale_parent");
            return;
        }

        const parentFilterId = parentFilterAttr.getValue()[0].id.replace("{", "").replace("}", "");

        try {
            const product = await Xrm.WebApi.retrieveRecord(
                "product",
                parentFilterId,
                "?$select=productnumber"
            );

            if (!allowedFamilies.includes(product.productnumber)) {
                formContext.getControl("dc_parentfilterid").setNotification(
                    errorMessage,
                    "boxsale_parent"
                );
            } else {
                formContext.getControl("dc_parentfilterid").clearNotification("boxsale_parent");
            }

        } catch (error) {
            console.error("Navco: Error validating parent filter.", error.message);
        }
    }

    async function validateProduct(formContext, allowedFamilies, errorMessage) {
        const productAttr = formContext.getAttribute("dc_productid");

        if (!productAttr || !productAttr.getValue()) {
            formContext.getControl("dc_productid")?.clearNotification("boxsale_product");
            return;
        }

        const productId = productAttr.getValue()[0].id.replace("{", "").replace("}", "");

        try {
            const product = await Xrm.WebApi.retrieveRecord(
                "product",
                productId,
                "?$select=parentproductid&$expand=parentproductid($select=productnumber)"
            );

            if (product.parentproductid && !allowedFamilies.includes(product.parentproductid.productnumber)) {
                formContext.getControl("dc_productid").setNotification(
                    errorMessage,
                    "boxsale_product"
                );
            } else {
                formContext.getControl("dc_productid").clearNotification("boxsale_product");
            }

        } catch (error) {
            console.error("Navco: Error validating product.", error.message);
        }
    }

    // Update Product From Search Control
    // Converted from D365 N52 Formula
   async function updateProductFromSearchControl(executionContext) {
        const formContext = executionContext.getFormContext();

        // Check if dc_selectedsearchproductid contains data
        const selectedSearchProductAttr = formContext.getAttribute("dc_selectedsearchproductid");

        if (!selectedSearchProductAttr || !selectedSearchProductAttr.getValue()) {
            return;
        }

        let selectedProductId = selectedSearchProductAttr.getValue();
        try {
            // Retrieve the product name
            const product = await Xrm.WebApi.retrieveRecord(
                "product",
                selectedProductId,
                "?$select=name"
            );

            const productName = product.name;

            // Create lookup value object
            const lookupValue = [{
                id: selectedProductId,
                name: productName,
                entityType: "product"
            }];

            // Set dc_productid field
            const dcProductIdAttr = formContext.getAttribute("dc_productid");
            if (dcProductIdAttr) {
                dcProductIdAttr.setValue(lookupValue);
                dcProductIdAttr.fireOnChange();
            }

            // Set productid field
            const productIdAttr = formContext.getAttribute("productid");
            if (productIdAttr) {
                productIdAttr.setValue(lookupValue);
            }

        } catch (error) {
            console.error("Navco: Error updating product from search control.", error.message);
        }
    }

    // Set Hidden Product Field
    // Converted from D365 N52 Formula
    function setHiddenProductField(executionContext) {
        const formContext = executionContext.getFormContext();

        // Check if dc_productid contains data
        const dcProductIdAttr = formContext.getAttribute("dc_productid");

        if (dcProductIdAttr && dcProductIdAttr.getValue()) {

            // Get the lookup value from dc_productid
            const dcProductValue = dcProductIdAttr.getValue()[0];

            // Create lookup value object for productid
            const lookupValue = [{
                id: dcProductValue.id,
                name: dcProductValue.name,
                entityType: "product"
            }];

            // Set productid field
            const productIdAttr = formContext.getAttribute("productid");
            if (productIdAttr) {
                productIdAttr.setValue(lookupValue);
            }

        } else {

            // Clear productid field if dc_productid is empty
            const productIdAttr = formContext.getAttribute("productid");
            if (productIdAttr) {
                productIdAttr.setValue(null);
            }
        }
    }

    // Set Cost Override Description Required
    // Converted from D365 N52 Formula
   function setCostOverrideDescriptionRequiredInOnChange(executionContext) {
        const formContext = executionContext.getFormContext();
        setCostOverrideDescriptionRequired(formContext);
    }

    function setCostOverrideDescriptionRequired(formContext) {
        // Check if dc_costoverride contains data
        const costOverrideAttr = formContext.getAttribute("dc_costoverride");
        const overrideDescriptionAttr = formContext.getAttribute("dc_overridedescription");

        if (!overrideDescriptionAttr) {
            return;
        }

        // If dc_costoverride has a value, make dc_overridedescription required
        if (costOverrideAttr && costOverrideAttr.getValue() != null) {
            overrideDescriptionAttr.setRequiredLevel("required");
        } else {
            // Otherwise, make it not required
            overrideDescriptionAttr.setRequiredLevel("none");
        }
    }

    // Toggle Special Product Margin
    // Converted from D365 N52 Formula
    async function toggleSpecialProductMargin(executionContext) {
        const formContext = executionContext.getFormContext();

        const quoteLookup =
            getLookupValue(formContext, "dc_quoteid") ||
            getLookupValue(formContext, "quoteid");

        if (!quoteLookup) return;

        const productAttr = formContext.getAttribute("dc_productid");
        const marginAttr = formContext.getAttribute("dc_marginrate");

        if (!productAttr || !productAttr.getValue() || !marginAttr) {
            return;
        }

        try {
            // Retrieve quote margins
            const quote = await Xrm.WebApi.retrieveRecord(
                quoteLookup.entityType,
                quoteLookup.id,
                "?$select=dc_standardproductmargin,dc_specialproductmargin"
            );

            const standardProductMargin = quote.dc_standardproductmargin;
            const specialProductMargin = quote.dc_specialproductmargin;

            // Get product family
            const productId = productAttr.getValue()[0].id.replace("{", "").replace("}", "");
            const productFamily = await getProductFamily(productId);

            // Determine margin based on product family and special product flag
            let marginRate = null;

            if (productFamily === "MATERIAL_FAMILY") {
                const specialProductAttr = formContext.getAttribute("dc_specialproduct");

                if (specialProductAttr && specialProductAttr.getValue() === true) {
                    marginRate = specialProductMargin;
                } else {
                    marginRate = standardProductMargin;
                }
            }

            // Set the margin rate field
            if (marginRate !== null) {
                marginAttr.setValue(marginRate);
            }

        } catch (error) {
            console.error("Navco: Error toggling special product margin.", error.message);
        }
    }

    // Filter Products
    // Converted from D365 N52 Formula
    function filterProducts(executionContext) {
        const formContext = executionContext.getFormContext();

        const parentFilterAttr = formContext.getAttribute("dc_parentfilterid");
        const itemTypeAttr = formContext.getAttribute("dc_itemtype");

        // Only proceed if both fields contain data
        if (!parentFilterAttr || !parentFilterAttr.getValue() || !itemTypeAttr || !itemTypeAttr.getValue()) {
            return;
        }

        try {
            const parentFilterId = parentFilterAttr.getValue()[0].id.replace("{", "").replace("}", "");
            const itemType = itemTypeAttr.getValue();

            // Get the product ID lookup control
            const productControl = formContext.getControl("dc_productid");
            if (!productControl) {
                console.warn("Navco: Product control not found.");
                return;
            }

            // Get FetchXml and LayoutXml (format with parameters)
            const fetchXml = formatFetchXmlForProductFilter(parentFilterId, itemType);
            const layoutXml = getProductFilterLayoutXml();

            // Add custom view to product lookup
            productControl.addCustomView(
                "{00000000-0000-0000-0000-000000000001}",
                "product",
                "FilteredProducts",
                fetchXml,
                layoutXml,
                true  // Set as default view
            );

        } catch (error) {
            console.error("Navco: Error filtering products.", error.message);
        }
    }

    // Show/Hide Quantity Values
    async function showHideQuantityValuesInOnChange(executionContext) {
        const formContext = executionContext.getFormContext();
        showHideQuantityValues(formContext);
    }

    async function showHideQuantityValues(formContext) {

        const productAttr = formContext.getAttribute("dc_productid");

        if (!productAttr || !productAttr.getValue()) {
            // If no product selected, hide monthly quantity
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

            if (productFamily === "MATERIAL_FAMILY" ||
                productFamily === "SERVICE_FAMILY" ||
                productFamily === "OUTSIDELABOR_FAMILY") {

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

    // Helper function to format FetchXml for product filtering
    // Uses the ProductFilter saved query configuration
    function formatFetchXmlForProductFilter(parentFilterId, itemType) {
        const fetchXml = `<fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
            <entity name="product">
                <attribute name="name" />
                <attribute name="productid" />
                <attribute name="dc_manufacturerid" />
                <attribute name="standardcost" />
                <attribute name="price" />
                <attribute name="dc_shortdescription" />
                <filter type="and">
                    <condition attribute="parentproductid" operator="eq" value="${parentFilterId}" />
                    <condition attribute="statecode" operator="eq" value="0" />
                </filter>
                <link-entity name="dc_productcategory" from="dc_productcategoryid" to="dc_productcategoryid" link-type="inner" alias="ad">
                    <filter type="and">
                        <condition attribute="dc_itemtype" operator="eq" value="${itemType}" />
                    </filter>
                </link-entity>
            </entity>
        </fetch>`;
        return fetchXml;
    }

    // Helper function to get LayoutXml for product filter view
    // Replace this with your actual LayoutXml
    function getProductFilterLayoutXml() {
        // TODO: Update this with the actual LayoutXml from your ProductFilter saved query
        const layoutXml = `<grid name="resultset"
                                    object="1024"
                                    jump="name"
                                    select="1"
                                    icon="1"
                                    preview="1">

                                <row name="result" id="productid">

                                    <cell name="name" width="200" />
                                    <cell name="dc_manufacturerid" width="150" />
                                    <cell name="dc_shortdescription" width="150" />
                                    <cell name="standardcost" width="150" />
                                    <cell name="price" width="100" />

                                </row>
                                </grid>
                                `;
        return layoutXml;
    }

    // Calculate Quantity from Monthly Quantity and Contract Length
    // Converted from D365 N52 Formula with updated contract field logic
    async function calculateQuantityFromMonthlyAndContract(executionContext) {
        const formContext = executionContext.getFormContext();
        
        const monthlyQtyAttr = formContext.getAttribute("dc_monthlyquantity");
        const quantityAttr = formContext.getAttribute("quantity");

        // Check if monthly quantity contains data and is not zero
        if (!monthlyQtyAttr || !monthlyQtyAttr.getValue() || monthlyQtyAttr.getValue() === 0) {
            return;
        }

        // Get the quote lookup
        const quoteLookup = getLookupValue(formContext, "dc_quoteid") || getLookupValue(formContext, "quoteid");

        if (!quoteLookup) {
            return;
        }

        try {
            // Retrieve the contract length from the quote
            const quote = await Xrm.WebApi.retrieveRecord(
                quoteLookup.entityType,
                quoteLookup.id,
                "?$select=dc_contractlength"
            );

            if (!quote.dc_contractlength) {
                return;
            }

            // Convert contract length option set value to years
            const contractTermYears = calculateContractYears(quote.dc_contractlength);
            
            // Calculate contract units (years * 12 months)
            const contractUnits = contractTermYears * 12;
            
            // Calculate total quantity (contract units * monthly quantity)
            const totalQuantity = contractUnits * monthlyQtyAttr.getValue();
            
            // Set the quantity field
            if (quantityAttr) {
                quantityAttr.setValue(totalQuantity);
            }

        } catch (error) {
            console.error("Navco: Error calculating quantity from monthly quantity and contract.", error.message);
        }
    }

    // Helper function to calculate contract years from option set value
    // Equivalent to backend CalculateContractYears method
    function calculateContractYears(contractTermOptionSetValue) {
        switch (contractTermOptionSetValue) {
            case 948170000:
                return 1;
            case 948170001:
                return 2;
            case 948170002:
                return 3;
            case 948170003:
                return 4;
            case 948170004:
                return 5;
            default:
                return 1;
        }
    }

}).call(NavcoQuoteLineSdk)