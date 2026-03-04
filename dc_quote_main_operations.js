var NavcoSdk = window.NavcoSdk || {};
(function () {

    /*----------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------- Event Handlers --------------------------------------------*/
    /*----------------------------------------------------------------------------------------------------------------*/
    function SetWarrantyRequiredOnUpdate(formContext) {

        // 2 = Update
        if (formContext.ui.getFormType() !== 2) {
            return;
        }
        setFieldRequired(formContext, "dc_warrantyoptionid");
    }

    function setFieldRequired(formContext, fieldName) {
        var attribute = formContext.getAttribute(fieldName);
        if (!attribute) {
            console.warn("Attribute not found:", fieldName);
            return;
        }

        attribute.setRequiredLevel("required");
    }
    // Code to run in the form OnLoad event
    // ================================
    // Form OnLoad Handler
    // ================================
    function SelectQuoteProcessAndForm(formContext) {

        var QUOTE_MODEL_BOX_SALE = 948170001;
        var QUOTE_MODEL_STANDARD = 948170000;
        var BPF_BOX_SALE_QUOTE_TO_ORDER = "Box Sale Quote to Order";
        var BPF_MULTIPLE_QUOTE_OPP_SALES = "Multiple Quote Opportunity Sales Process";

        var quoteModelAttr = formContext.getAttribute("dc_quotemodel");
        if (!quoteModelAttr || quoteModelAttr.getValue() === null) {
            return;
        }

        var quoteModel = quoteModelAttr.getValue();
        var opportunityAttr = formContext.getAttribute("opportunityid");
        var opportunityRef = opportunityAttr ? opportunityAttr.getValue() : null;

        /* -------------------------------
           BOX SALE QUOTE
        --------------------------------*/
        if (quoteModel === QUOTE_MODEL_BOX_SALE) {

            if (formContext.ui.getFormType() !== 1) { 
                setBpfByName(formContext, BPF_BOX_SALE_QUOTE_TO_ORDER);
            }
            
            selectFormByName(formContext, "Box Sale Quote");
            return;
        }

        /* -------------------------------
           STANDARD MODEL QUOTE
        --------------------------------*/
        if (quoteModel === QUOTE_MODEL_STANDARD) {
            if (opportunityRef && opportunityRef.length > 0) {
                var opportunityId = opportunityRef[0].id.replace("{", "").replace("}", "");

                checkMultipleOpportunityQuotes(opportunityId, function (hasMultipleQuotes) {
                    if (hasMultipleQuotes) {
                        setBpfByName(formContext, BPF_MULTIPLE_QUOTE_OPP_SALES);
                    }
                });
            }

            selectFormByName(formContext, "Standard Model Quote");
        }
    };

    // ================================
    // Set BPF by Name (Environment-safe)
    // ================================
    function setBpfByName(formContext, processName) {
        var fetchXml =
            `<fetch top="1">
            <entity name="workflow">
                <attribute name="workflowid" />
                <filter>
                    <condition attribute="name" operator="eq" value="${processName}" />
                    <condition attribute="type" operator="eq" value="1" />
                    <condition attribute="statecode" operator="eq" value="1" />
                </filter>
            </entity>
        </fetch>`;

        Xrm.WebApi.retrieveMultipleRecords(
            "workflow",
            "?fetchXml=" + encodeURIComponent(fetchXml)
        ).then(
            function (result) {
                if (result.entities.length === 0) {
                    console.warn("BPF not found or not active:", processName);
                    return;
                }

                var processId = result.entities[0].workflowid;

                formContext.data.process.setActiveProcess(processId, function (success) {
                    if (!success) {
                        console.warn("Failed to set BPF:", processName);
                    }
                });

            },
            function (error) {
                console.error("Error retrieving BPF:", error.message);
            }
        );
    }

    function selectFormByName(formContext, formName) {
        var currentForm = formContext.ui.formSelector.getCurrentItem();
        if (currentForm && currentForm.getLabel() === formName) {
            return;
        }

        var forms = formContext.ui.formSelector.items.get();
        for (var i = 0; i < forms.length; i++) {
            if (forms[i].getLabel() === formName) {
                forms[i].navigate();
                return;
            }
        }
    }
    // ================================
    // Check for Multiple Active Quotes
    // ================================
    function checkMultipleOpportunityQuotes(opportunityId, callback) {
        var fetchXml =
            `<fetch distinct="true">
            <entity name="quote">
                <attribute name="quoteid" />
                <filter>
                    <condition attribute="opportunityid" operator="eq" value="${opportunityId}" />
                    <condition attribute="statecode" operator="eq" value="0" />
                </filter>
            </entity>
        </fetch>`;

        Xrm.WebApi.retrieveMultipleRecords(
            "quote",
            "?fetchXml=" + encodeURIComponent(fetchXml)
        ).then(
            function (result) {
                callback(result.entities.length > 1);
            },
            function (error) {
                console.error("Error checking opportunity quotes:", error.message);
                callback(false);
            }
        );
    }


    this.HideSecuredFieldsOnCreate = function (executionContext) {
        var formContext = executionContext.getFormContext();

        if (formContext.ui.getFormType() == 1) {
            formContext.getControl('dc_miscellaneousmaterialcostoverride')?.setVisible(false);
            formContext.getControl('dc_shippingcostoverride')?.setVisible(false);
            formContext.getControl('dc_warrantyoverridecost')?.setVisible(false);
            formContext.getControl('dc_margindollars')?.setVisible(false);
        } else {
            formContext.getControl('dc_miscellaneousmaterialcostoverride')?.setVisible(true);
            formContext.getControl('dc_shippingcostoverride')?.setVisible(true);
            formContext.getControl('dc_warrantyoverridecost')?.setVisible(true);
            formContext.getControl('dc_margindollars')?.setVisible(true);
        }
    }
    function isForm(formContext, formName) {
        var currentForm = formContext.ui.formSelector.getCurrentItem();
        return currentForm && currentForm.getLabel() === formName;
    }
    function checkForDiscontinuedProducts(formContext) {

        const stateCode = formContext.getAttribute("statecode").getValue();

        if (stateCode === 0 || stateCode === 1) {
            const hasDiscontinuedProducts = formContext.getAttribute("dc_hasdiscontinuedproducts").getValue();

            if (hasDiscontinuedProducts) {
                formContext.ui.setFormNotification(
                    "ERROR: This quote contains discontinued products!",
                    "ERROR",
                    "discprods"
                );
            } else {
                formContext.ui.clearFormNotification("discprods");
            }
        }
    }

   function clearInstallationCenterAndDistance(executionContext) {
        const formContext = executionContext.getFormContext();

        const location = formContext.getAttribute("dc_locationid").getValue();

        if (location === null || location === undefined) {
            formContext.getAttribute("dc_installationdistance").setValue(null);
            formContext.getAttribute("dc_installationcenterid").setValue(null);
        }
    }

    this.validateMarginDollars = function (executionContext) {
        const formContext = executionContext.getFormContext();
        let marginDollars = formContext.getAttribute("dc_margindollars")?.getValue();
        let totalLaborPrice = formContext.getAttribute("dc_totallaborprice")?.getValue();

        if (totalLaborPrice === null || totalLaborPrice === undefined) {
            totalLaborPrice = 0;
        }

        if (marginDollars === null || marginDollars === undefined) {
            marginDollars = 0;
        }

        if ((marginDollars + totalLaborPrice) < 0) {
            formContext.getControl("dc_margindollars").setNotification(
                "Negative Margin Dollars cannot exceed Total Material Labor Price!"
            );
        } else {
            formContext.getControl("dc_margindollars").clearNotification();
        }


        if (marginDollars === 0) {
            formContext.getAttribute("dc_margindollars").setValue(null);
        }
    };
    // Code to run in the form OnLoad event
    this.formOnLoad = async function (executionContext) {
        var formContext = executionContext.getFormContext();

        var messageUniqueId = "accountIsOnCreditHold";

        formContext.ui.clearFormNotification(messageUniqueId);

        var account = formContext.getAttribute('customerid').getValue();

        if (account && account.length > 0) {
            const accountOnCreditHold = await isAccountOnCreditHold(account[0].id.replace("{", "").replace("}", ""));

            if (accountOnCreditHold) {
                formContext.ui.setFormNotification("Cannot create order. Customer on Credit Hold", "WARNING", messageUniqueId);
            }
        }

        removeDuplicateWarrantyOptionsIfExists(formContext)

        handleForecastProfitCenterOptions(formContext)
        SelectQuoteProcessAndForm(formContext);
        checkForDiscontinuedProducts(formContext);
        if (isForm(formContext, "Standard Model Quote")) {

            SetWarrantyRequiredOnUpdate(formContext);//add if-statement
        }
        // ensure field is added to the form. The dc_installdifficultydisplay is added to standard model quotes only.
        // and this script is used in standard model and box sales quotes forms.
        if (formContext.getAttribute('dc_installdifficultydisplay') && formContext.getControl('dc_installdifficultydisplay')) {
            // a work around to hide label of this field but preserve space. So that value is aligned with other fields
            // in the section
            formContext.getControl('dc_installdifficultydisplay').setLabel('                                         ')
            installDifficultyDisplayValue(formContext)
        }

        const isStandardModelQuote = formContext.getAttribute('dc_quotemodel').getValue() === 948170000

        if (isStandardModelQuote) {
            this.laborPriceMethod(executionContext)
        }

        formContext.data.addOnLoad(onDataLoadHandler)

    }

    this.onLocationChange = function (executionContext) {
        clearInstallationCenterAndDistance(executionContext)
    }

    // validate the "Forecast profit Center" field to make it required when user try to
    // clear its value.
    this.makeForecastProfitCenterRequiredWhenCleared = async function (executionContext) {
        let formContext = executionContext.getFormContext()

        let forecastProfitCenter = formContext.getAttribute('dc_forecastprofitcenter').getValue()

        if (!forecastProfitCenter) {
            formContext.getAttribute('dc_forecastprofitcenter').setRequiredLevel('required')
        } else {
            formContext.getAttribute('dc_forecastprofitcenter').setRequiredLevel('none')
        }
    }

    // handler for margin fields change
    this.handleOnMarginFieldChange = function (executionContext, fieldName) {
        const formContext = executionContext.getFormContext()

        const marginFieldValue = formContext.getAttribute(fieldName).getValue()

        if (marginFieldValue == null) {
            formContext.getAttribute(fieldName).setRequiredLevel('required')
        } else {
            formContext.getAttribute(fieldName).setRequiredLevel('none')
        }
    }

    /*----------------------------------------------------------------------------------------------------------------*/
    /*---------------------------------------------------- Helper Methods --------------------------------------------*/
    /*----------------------------------------------------------------------------------------------------------------*/

    function onDataLoadHandler(executionContext) {
        NavcoSdk.HideSecuredFieldsOnCreate(executionContext)
    }

    /**
     * Check if given account is on credit hold
     * 
     * @param accountId
     * @returns
     */
    async function isAccountOnCreditHold(accountId) {
        var globalContext = Xrm.Utility.getGlobalContext();

        var clientUrl = globalContext.getClientUrl();

        var accountOnCreditHold = false;

        await fetch(`${clientUrl}/api/data/v9.2/accounts(${accountId})?$select=creditonhold`)
            .then(response => response.json())
            .then(response => {
                accountOnCreditHold = response.creditonhold
            })
            .catch(error => console.log(error));

        return accountOnCreditHold;
    }

    function removeDuplicateWarrantyOptionsIfExists(formContext) {
        var globalContext = Xrm.Utility.getGlobalContext();
        var clientUrl = globalContext.getClientUrl();

        var recordId = formContext.data.entity.getId();

        // quote is not draft, then do nothing
        if (formContext.getAttribute('statecode').getValue() != 0) {
            console.log('nothing is done')
            return
        }

        fetch(`${clientUrl}/api/data/v9.2/dc_warrantyoptions?$select=dc_warrantyoptionid,_dc_warrantyscheduleid_value&$filter=_dc_quoteid_value eq '${recordId}'`)
            .then(response => response.json())
            .then(response => {
                const groupedWarrantyOptions = response.value.reduce((acc, ele) => {
                    const warrantySchedule = ele._dc_warrantyscheduleid_value;
                    if (!acc[warrantySchedule]) {
                        acc[warrantySchedule] = [];
                    }

                    acc[warrantySchedule].push(ele);
                    return acc;
                },
                    {}
                )

                Object.values(groupedWarrantyOptions)
                    .filter(warrantyOptionGroup => warrantyOptionGroup.length > 1)
                    .forEach(warrantyOptionGroup => {
                        const warrantyOptionToRemove = warrantyOptionGroup[0]

                        Xrm.WebApi.online.deleteRecord("dc_warrantyoption", warrantyOptionToRemove.dc_warrantyoptionid)
                    })
            })
            .catch(error => console.log(error))
    }

    /**
     * Hide 502 option from forecast profit center field for open records and when this value
     * is not already selected
     * 
     * @param {*} formContext 
     */
    function handleForecastProfitCenterOptions(formContext) {
        // if we are in create form, then hide option
        if (formContext.ui.getFormType() == 1) {
            formContext.getControl('dc_forecastprofitcenter').removeOption(808630006)
            return
        }

        // if record is in open state and value is not selected, then hide it
        let selectedProfitCenter = formContext.getAttribute('dc_forecastprofitcenter').getValue()
        let state = formContext.getAttribute('statecode').getValue()

        if (state == 0 && selectedProfitCenter != 808630006) {
            formContext.getControl('dc_forecastprofitcenter').removeOption(808630006)
            return
        }
    }

    /**
     * Register on change event for install difficulty display value
     * @param {*} formContext 
     */
    function installDifficultyDisplayValue(formContext) {
        formContext.getAttribute("dc_installdifficulty").addOnChange(onInstallDifficultyOptionSetChange);
        setInstallDifficultyDisplayValue(formContext)
    }

    function onInstallDifficultyOptionSetChange(executionContext) {
        const formContext = executionContext.getFormContext()
        const optionSetValue = formContext.getAttribute("dc_installdifficulty").getValue()

        formContext.getAttribute("dc_installdifficultydisplay").setValue(getInstallDifficultyDisplayValue(optionSetValue))
    }

    function getInstallDifficultyDisplayValue(value) {
        switch (value) {
            case 948170000:
                return "Open Ceiling or Push-Up Tile <12' Ceiling Height"
            case 948170001:
                return "Interlocking Tile, Solid, or Sheetrock, <12' Ceiling Height"
            case 948170002:
                return "Any Ceiling Height >12'; Lift Required"
            default:
                return ""
        }
    }

    function setInstallDifficultyDisplayValue(formContext) {
        var optionSetValue = formContext.getAttribute("dc_installdifficulty").getValue()
        formContext.getAttribute("dc_installdifficultydisplay").setValue(getInstallDifficultyDisplayValue(optionSetValue))
    }

    this.laborPriceMethod = function (executionContext) {
        const formContext = executionContext.getFormContext();

        if (!formContext.getAttribute("dc_laborpricemethod")) {
            return
        }

        const laborPriceMethod = formContext.getAttribute("dc_laborpricemethod").getValue();

        const marginPriceRateFields = [
            'dc_travelhoursmarginpricerate',
            'dc_type1labormarginpricerate',
            'dc_type2labormarginpricerate',
            'dc_type3labormarginpricerate'
        ];

        const fixedPriceRateFields = [
            'dc_travelhoursfixedpricerate',
            'dc_type1laborfixedpricerate',
            'dc_type2laborfixedpricerate',
            'dc_type3laborfixedpricerate'
        ];

        const setVisibility = ((fields, isVisible) =>
            fields.forEach(field => formContext.getControl(field).setVisible(isVisible))
        );

        const setRequiredLevel = ((fields, level) =>
            fields.forEach(field => formContext.getAttribute(field).setRequiredLevel(level))
        );

        const setDisabled = ((fields, isDisabled) =>
            fields.forEach(field => formContext.getControl(field).setDisabled(isDisabled))
        );

        const setFieldValues = (fields, sourceFields) => {
            fields.forEach((field, index) => {
                const sourceValue = formContext.getAttribute(sourceFields[index]).getValue();
                formContext.getAttribute(field).setValue(sourceValue);
            });
        };

        if (laborPriceMethod === 948170001) { // Fixed Price Method
            setFieldValues(fixedPriceRateFields, marginPriceRateFields);

            setVisibility(fixedPriceRateFields, true);
            setRequiredLevel(fixedPriceRateFields, 'none');
            setDisabled(fixedPriceRateFields, true);

            setVisibility(marginPriceRateFields, false);
        } else if (laborPriceMethod === 948170000) { // Margin Price Method
            setVisibility(marginPriceRateFields, true);

            setVisibility(fixedPriceRateFields, false);
            setRequiredLevel(fixedPriceRateFields, 'none');
        }
    }

    this.setWarnings = function (executionContext) {
        const formContext = executionContext.getFormContext();

        // Should only run on Update, Exit if it's a new record
        if (formContext.data.entity.getId() === "") {
            return
        }

        const isProjectManagerHoursLessThanMinMgtHour = formContext.getAttribute("dc_isprojectmanagerhourslessthanminmgthour").getValue();
        const locationValid = formContext.getAttribute("dc_locationvalid").getValue();

        if (isProjectManagerHoursLessThanMinMgtHour) {
            formContext.ui.setFormNotification(
                "Total Project Manager hours is less than Minimum Management Hours",
                "WARNING",
                "minmgmthours"
            );
        } else {
            formContext.ui.clearFormNotification("minmgmthours");
        }

        if (!locationValid) {
            formContext.ui.setFormNotification(
                "The location for this opportunity is not valid!",
                "ERROR",
                "invalidlocation"
            );
        } else {
            formContext.ui.clearFormNotification("invalidlocation");
        }
    }
     this.RecalculateInstallationDistance = function (formContext) {
        var confirmStrings = { text: "Are you sure you want to recalculate the installation center and distance?", title: "Confirmation Dialog" };
        var confirmOptions = { height: 200, width: 450 };

        var currentRecordId = formContext.data.entity.getId().replace("{", "").replace("}", "");
        Xrm.Navigation.openConfirmDialog(confirmStrings, confirmOptions).then(
            function (success) {
                if (success.confirmed) {
                    console.log("current record ID" + currentRecordId);
                    var query = "quotes(" + currentRecordId + ")/Microsoft.Dynamics.CRM.dc_RecalculateInstallationDistanceQuote";
                    var url = Xrm.Utility.getGlobalContext().getClientUrl() + "/api/data/v9.2/" + query;

                    Xrm.Utility.showProgressIndicator("Processing...");

                    fetch(url, {
                        method: "POST",
                        headers: {
                            "OData-MaxVersion": "4.0",
                            "OData-Version": "4.0",
                            "Accept": "application/json",
                            "Content-Type": "application/json; charset=utf-8"
                        }
                    })
                        .then(response => {
                            if (response.status !== 204) {
                                return response.json().then(error => {
                                    throw new Error(error.error.message);
                                });
                            }
                        })
                        .then(() => {
                            formContext.ui.setFormNotification("Recalculation completed successfully.", "INFO", "Success");
                            formContext.data.refresh(true);
                        })
                        .catch(error => {
                            Xrm.Utility.alertDialog("An error occurred: " + error.message);
                            formContext.ui.setFormNotification("An error occurred: " + error.message, "ERROR", "Failure");
                        })
                        .finally(() => {
                            Xrm.Utility.closeProgressIndicator();
                        });
                }

            });

    };

}).call(NavcoSdk);


/**
* Check if related account is not on credit hold. This need to be out of scope since ribbon workbench doesn't work when it
* is in namespace. 
* @param {} formContext 
* @returns 
*/
function isAccountNotOnCreditHold(formContext) {
    return new Promise(function (resolve, reject) {
        var globalContext = Xrm.Utility.getGlobalContext();

        var clientUrl = globalContext.getClientUrl();

        var account = formContext.getAttribute('customerid').getValue();

        if (account && account.length > 0) {

            const accountId = account[0].id.replace("{", "").replace("}", "");

            fetch(`${clientUrl}/api/data/v9.2/accounts(${accountId})?$select=creditonhold`)
                .then(response => response.json())
                .then(response => {
                    resolve(!response.creditonhold);
                })
                .catch(error => console.log(error));

        }
    });
}