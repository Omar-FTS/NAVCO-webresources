
var NavcoSdk = window.NavcoSdk || {};
(function () {

    // Code to run in the form OnLoad event
    this.formOnLoad = async function (executionContext) {
        var formContext = executionContext.getFormContext();

        var userHasRole = await checkUserHasRole("NAVCO - Allow Closed Posted");
        if (!userHasRole) {
            formContext.getControl("header_statecode").setDisabled(true)
            formContext.getControl("header_statuscode").setDisabled(true)
        }

        displayOrderIsCreatedFromALeaseQuoteWarning(formContext);

        setGenerateWorkOrderFlag(formContext);

    }

    // coverated formula
    this.CreateServiceLocation = function (executionContext){
        var confirmStrings = { text:"Are you sure you want to create a new Service Location?", title:"Confirmation Dialog" };
        var confirmOptions = { height: 200, width: 450 };
        Xrm.Navigation.openConfirmDialog(confirmStrings, confirmOptions).then(
             function (success) {    
            if (success.confirmed)
                 CreateServiceLocationAction(executionContext)
            
        });
        }

    this.SetOrderMessages = function (executionContext) {
            debugger;
            var formContext = executionContext.getFormContext();
            var locationid = formContext.getAttribute('dc_locationid').getValue();
            var serviceLocation = formContext.getAttribute('dc_servicelocationid').getValue();
            var orderId = formContext.data.entity.getId().replace("{", "").replace("}", "");
        
            if (locationid == null) {
        
                formContext.ui.setFormNotification('A location is required when you convert a quote to an order.', 'ERROR', 'missinglocation');
            } else {
                formContext.ui.clearFormNotification("missinglocation");
            }
        
            if (locationid != null && serviceLocation == null) {
                var fetchXml = "?fetchXml=<fetch top='50'>  <entity name='salesorder'>    <attribute name='dc_ordernumber' />    <attribute name='ordernumber' />    <attribute name='dc_locationid' />    <filter>      <condition attribute='salesorderid' operator='eq' value='"+orderId+"' uiname='2nd opp test shld populate' uitype='salesorder' />    </filter>    <link-entity name='dc_location' from='dc_locationid' to='dc_locationid' alias='location' visible='true'>      <attribute name='dc_name' />  <attribute name='dc_servicelocationid' />      <link-entity name='account' from='accountid' to='dc_servicelocationid' alias='serviceLocation' visible='true'>        <attribute name='accountid' />        <attribute name='name' />      </link-entity>    </link-entity>  </entity></fetch>";
        
                Xrm.WebApi.retrieveMultipleRecords("salesorder", fetchXml).then(
                    function success(result) {
                    var locationdServicelocationid = null;
                    if(result.entities.length > 0){
                        locationdServicelocationid = result.entities[0]["location.dc_servicelocationid"];
                    }
                    
                    
                    if (locationdServicelocationid != null) {
                        var accountId = result.entities[0]["serviceLocation.accountid"];
                        var accountName = result.entities[0]["serviceLocation.name"];
                        var lookupValue = new Array();
                        lookupValue[0] = new Object();
                        lookupValue[0].id = accountId;
                        lookupValue[0].name = accountName;
                        lookupValue[0].entityType = "account";
                        formContext.getAttribute("dc_servicelocationid").setValue(lookupValue);
                    } else {
                        formContext.ui.setFormNotification('The sales location is missing a service location. Please create a new service location first', 'ERROR', 'missingservicelocation');
        
                    }
                    // perform additional operations on retrieved records
                },
                    function (error) {
                    console.log(error.message);
                    // handle error conditions
                });
        
            }
        
            if (serviceLocation != null) {
                var id = serviceLocation[0].id.replace('{', '').replace('}', '');
        
                var filter = "?$select=_nav_warehouseid_value,nav_gpprofitcenternew,statuscode&$filter=accountid eq " + id;
        
                Xrm.WebApi.retrieveMultipleRecords("account", filter).then(function success(result) {
                    if (result.entities.length > 0) {
                        console.log(result.entities[0]["_nav_warehouseid_value@OData.Community.Display.V1.FormattedValue"]);
                        var warehouseName = result.entities[0]["_nav_warehouseid_value@OData.Community.Display.V1.FormattedValue"]
                            var warehouseId = result.entities[0]["_nav_warehouseid_value"]
                            var profitCenterOption = result.entities[0]["nav_gpprofitcenternew"];
        
                        var stateCode = result.entities[0]["statuscode"];
        
                        var lookupValue = new Array();
                        lookupValue[0] = new Object();
                        lookupValue[0].id = warehouseId;
                        lookupValue[0].name = warehouseName;
                        lookupValue[0].entityType = "msdyn_warehouse";
                        formContext.getAttribute("dc_warehouseid").setValue(lookupValue);
        
                        Xrm.Page.getAttribute("dc_profitcenter").setValue(profitCenterOption);
                        if (stateCode == 948170000) {
                            formContext.ui.setFormNotification('This order cannot be converted to a work order until the service account is completed in GP', 'ERROR', 'pendingaccount')
                            formContext.getAttribute("dc_pendingservicelocation").setValue(true);
        
                        }
                        if (stateCode != 948170000) {
                            formContext.getAttribute("dc_pendingservicelocation").setValue(false);
        
                        }
        
                    }
                });
            }
            if (serviceLocation == null) {
                formContext.getAttribute("dc_pendingservicelocation").setValue(true);
        
            }
            var pendingproducts = formContext.getAttribute('dc_pendingproducts').getValue();
            if (pendingproducts == true) {
                formContext.ui.setFormNotification('This order has product(s) that have not been added to GP yet.', 'ERROR', 'pendingproducts')
        
            }
        
            // check if location account is not Set
        if(locationid !=null && locationid != undefined){
            var id = locationid[0].id.replace('{', '').replace('}', '');
        
            var fetchXml = "?fetchXml=<fetch top='50'>  <entity name='salesorder'>    <filter>      <condition attribute='salesorderid' operator='eq' value='"+orderId+"' uiname='2nd opp test shld populate' uitype='salesorder' />    </filter>    <link-entity name='dc_location' from='dc_locationid' to='dc_locationid'>      <link-entity name='account' from='accountid' to='dc_accountid' alias='account'>        <attribute name='accountnumber' />      </link-entity>    </link-entity>  </entity></fetch>";
        
            Xrm.WebApi.retrieveMultipleRecords("salesorder", fetchXml).then(
                function success(result) {
        
                if (result.entities[0]["account.accountnumber"] == null) {
                    formContext.ui.setFormNotification('This order is for a customer not yet in GP.', 'ERROR', 'newaccount')
        
                }else{
                    formContext.getAttribute("dc_pendingbillingaccount").setValue(false);
        
                }
        
            },function (error) {
                console.log(error.message);
                // handle error conditions
            });
            
        }
        
        }

    this.updatePendingGPProducts = function(executionContext){
        var confirmStrings = { text:"Are you sure you want to send new products to GP?", title:"Confirmation Dialog" };
        var confirmOptions = { height: 200, width: 450 };
        Xrm.Navigation.openConfirmDialog(confirmStrings, confirmOptions).then(
        function (success) {    
            if (success.confirmed)
                updatePendingGPProductsAction(executionContext)
        });
    }
    /**
 * Check if user has given role
 * @param {string} roleName 
 */
    async function checkUserHasRole(roleName) {

        var userId = Xrm.Utility.getGlobalContext().userSettings.userId;

        var xml = " <fetch mapping=\"logical\" > ";
        xml += " <entity name=\"systemuser\" > ";
        xml += " <attribute name=\"fullname\" /> ";
        xml += " <filter> ";
        xml += " <condition attribute=\"systemuserid\" operator=\"eq\" value=\"" + userId.replace("{", "").replace("}", "") + "\" /> ";
        xml += " </filter> ";
        xml += " <link-entity name=\"systemuserroles\" from=\"systemuserid\" to=\"systemuserid\" > ";
        xml += " <link-entity name=\"role\" from=\"roleid\" to=\"roleid\" > ";
        xml += " <attribute name=\"name\"  alias = \"roleName\"/> ";
        xml += " <attribute name=\"roleid\" /> ";
        xml += " </link-entity> ";
        xml += " </link-entity> ";
        xml += " </entity> ";
        xml += " </fetch> ";

        var userHasRole = false;

        await Xrm.WebApi.retrieveMultipleRecords("systemuser", "?fetchXml= " + encodeURIComponent(xml)).then(
            function success(result) {
                if (result.entities && result.entities.length > 0) {
                    for (var i = 0; i < result.entities.length; i++) {
                        if (result.entities[i].roleName === roleName) {
                            userHasRole = true;
                        }
                    }
                }
            })

        return userHasRole
    }

    /**
     * Check the location for this order and if it is manually validated show a message on form.
     * @param {*} formContext 
     */
    function displayOrderIsCreatedFromALeaseQuoteWarning(formContext) {

        let globalContext = Xrm.Utility.getGlobalContext()
        let clientUrl = globalContext.getClientUrl()


        let quote = formContext.getAttribute("quoteid").getValue()

        if (quote && quote.length > 0) {
            let quoteId = quote[0].id.replace("{", "").replace("}", "")

            fetch(`${clientUrl}/api/data/v9.2/quotes(${quoteId})?$select=dc_islease`, {
                headers: {
                    'Content-Type': 'application/json',
                    'OData-MaxVersion': '4.0',
                    'OData-Version': '4.0',
                    'Prefer': 'odata.include-annotations="*"'
                },
            })
                .then(response => response.json())
                .then(response => {

                    if (response["dc_islease"]) {
                        formContext.ui.setFormNotification(
                            "This order is a lease",
                            "WARNING",
                            "OrderIsCreatedFromALeaseQuoteWarningMessageId"
                        );
                    }

                }).catch(error => console.log(error))
        }

    }

    /**
     * Set the generate work order flag
     * @param {*} formContext 
     */
    function setGenerateWorkOrderFlag(formContext) {
        debugger

        const workOrder = formContext.getAttribute('dc_msdyn_workorderid').getValue()
        const pendingBillingAccount = formContext.getAttribute('dc_pendingbillingaccount').getValue()

        if((workOrder != null && Array.isArray(workOrder) && workOrder.length > 0) || pendingBillingAccount) {
            formContext.getAttribute('dc_generateworkorder').setValue(false)
        } else {
            formContext.getAttribute('dc_generateworkorder').setValue(true)
        }

    }

    async function CreateServiceLocationAction(executionContext) {
        var formContext = executionContext;
            // Get the dc_locationid field value
            var dcLocation = formContext.getAttribute("dc_locationid").getValue();
        debugger;
        const dcLocationId=dcLocation[0].id.slice(1, -1);
            if (dcLocation) {
                // Retrieve the full dc_location record to access the service location id and other related fields
                try {
                    var locationRecord = await Xrm.WebApi.retrieveRecord("dc_location", dcLocationId, "?$select=_dc_servicelocationid_value,dc_name,dc_address1_city,dc_address1_country,dc_address1_county,dc_address1_latitude,dc_address1_longitude,dc_address1_stateorprovince,dc_address1_line1,dc_address1_line2,dc_address1_line3,dc_profitcenter,dc_notes,dc_storenumber&$expand=dc_accountid($select=industrycode,accountid)");
        
                    // Check if the service location is missing
                    if (!locationRecord._dc_servicelocationid_value) {
                        // Prepare data for the new service location account
                        var newServiceLocation = {
                            name: locationRecord.dc_name,
                            address1_addresstypecode: 4,
                            address1_city: locationRecord.dc_address1_city,
                            address1_country: locationRecord.dc_address1_country,
                            address1_county: locationRecord.dc_address1_county,
                            address1_latitude: locationRecord.dc_address1_latitude,
                            address1_longitude: locationRecord.dc_address1_longitude,
                            address1_name: locationRecord.dc_name,
                            address1_stateorprovince: locationRecord.dc_address1_stateorprovince,
                            address1_line1: locationRecord.dc_address1_line1,
                            address1_line2: locationRecord.dc_address1_line2,
                            address1_line3: locationRecord.dc_address1_line3,
                            industrycode: locationRecord.dc_accountid ? locationRecord.dc_accountid.industrycode : null,
                            nav_gpprofitcenternew: locationRecord.dc_profitcenter,
                            customertypecode: 690970000,
                            msdyn_workorderinstructions: locationRecord.dc_notes,
                            nav_storenumber: locationRecord.dc_storenumber
                        };
                        newServiceLocation['msdyn_billingaccount_account@odata.bind']=locationRecord.dc_accountid ? `/accounts(${locationRecord.dc_accountid.accountid})`:null;
                        // Create the service location record
                        var createdServiceLocationId = await Xrm.WebApi.createRecord("account", newServiceLocation);
        
                        // Update the status of the created service location
                        var updateStatus = { statuscode: 948170000 };
                        await Xrm.WebApi.updateRecord("account", createdServiceLocationId.id, updateStatus);
        
                        // Update the current dc_location with the newly created service location
                        var updateLocation = {
                        };
                         updateLocation['dc_servicelocationid@odata.bind']=`/accounts(${createdServiceLocationId.id})`;
                        await Xrm.WebApi.updateRecord("dc_location", dcLocationId, updateLocation);
        
                        const accountName = await getAccountName(createdServiceLocationId.id);
                        // Set the client-side field for dc_servicelocationid
                        formContext.getAttribute("dc_servicelocationid").setValue([{
                            id: createdServiceLocationId.id,
                            entityType: "account",
                            name: accountName
                        }]);
        
                    }
                    formContext.ui.setFormNotification(
                        "Service Location Created successfully!",
                        "INFO",
                        "ServiceLocationCreatedInfoMessageId"
                    )
                } catch (error) {
                    formContext.ui.setFormNotification(
                        "Create Service Location failed!",
                        "ERROR",
                        "CreateServiceLocationFaildErrorMessageId"
                    )
                 }
            }
      
        
        // Helper function to get account name for the newly created service location
          async function getAccountName(accountId) {
            try {
                var result = await Xrm.WebApi.retrieveRecord("account", accountId, "?$select=name");
                return result.name;
            } catch (error) {
                console.error("Error retrieving account name: ", error);
                return null;
            }
        }
        
    }
    async function updatePendingGPProductsAction(executionContext) {
        var formContext = executionContext;
        debugger;
        // Get the sales order's quote ID
        var quote= formContext.getAttribute("quoteid").getValue();
        const quoteId=quote[0].id.replace("{", "").replace("}", "");
        if (quoteId) {
            try {
                // Step 1: Define FetchXML query using the quoteId
                var fetchXml = `
                    <fetch>
                        <entity name="product">
                            <attribute name="productid" />
                            <filter>
                                <condition attribute="statuscode" operator="eq" value="948170003" />
                            </filter>
                            <link-entity name="quotedetail" from="productid" to="productid">
                                <link-entity name="quote" from="quoteid" to="dc_quoteid">
                                    <filter>
                                        <condition attribute="quoteid" operator="eq" value="${quoteId}" />
                                    </filter>
                                </link-entity>
                            </link-entity>
                        </entity>
                    </fetch>
                `;
    
                // Step 2: Execute FetchXML to retrieve products related to the quote
                var productsResult = await Xrm.WebApi.retrieveMultipleRecords("product", "?fetchXml=" + encodeURIComponent(fetchXml));
    
                // Step 3: Loop through each product and update 'dc_sendtogp' to 1
                for (let i = 0; i < productsResult.entities.length; i++) {
                    let productId = productsResult.entities[i].productid;
    
                    // Update the 'dc_sendtogp' field for the current product
                    await Xrm.WebApi.updateRecord("product", productId, {
                        dc_sendtogp: true
                    });
                }
    
            } catch (error) {
                console.error("Error updating pending GP products: ", error);
            }
        } else {
            console.error("Quote ID is missing.");
        }
    }
   

}).call(NavcoSdk);