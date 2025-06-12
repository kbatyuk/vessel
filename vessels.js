var vesselSelector = "span[data-cvoc-protocol='r2r-vessel']";
var vesselInputSelector = "input[data-cvoc-protocol='r2r-vessel']";
var vesselPrefix = "r2r-vessel:";
var term; // Global variable to store search term

$(document).ready(function() {
    expandVessels();
    updateVesselInputs();
});

// Utility functions
function storeValue(prefix, key, value) {
    if (typeof Storage !== "undefined") {
        localStorage.setItem(prefix + key, JSON.stringify({name: value}));
    }
}

function getValue(prefix, key) {
    if (typeof Storage !== "undefined") {
        var stored = localStorage.getItem(prefix + key);
        return stored ? JSON.parse(stored) : {name: null};
    }
    return {name: null};
}

function markMatch(text, term) {
    if (!term) return text;
    var regex = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function expandVessels() {
    $(vesselSelector).each(function() {
        var vesselElement = this;
        if (!$(vesselElement).hasClass('expanded')) {
            $(vesselElement).addClass('expanded');
            var vesselBaseUrl = $(vesselElement).attr('data-cvoc-service-url');
            
            if (!vesselBaseUrl) {
                vesselBaseUrl = "https://www.rvdata.us/vessel/";
            }
            
            var id = vesselElement.textContent;
            if (id.startsWith(vesselBaseUrl)) {
                id = id.substring(vesselBaseUrl.length);
            }
            
            // Call R2R vessel API
            var vesselRetrievalUrl = "https://service.rvdata.us/api/vessel/keyword/" + encodeURIComponent(id);
            $.ajax({
                type: "GET",
                url: vesselRetrievalUrl,
                dataType: 'json',
                headers: {
                    'Accept': 'application/json'
                },
                success: function(vessels, status) {
                    if (vessels && vessels.length > 0) {
                        var vessel = vessels[0]; // Take first match
                        var displayName = vessel.name + " (" + vessel.ices_code + ")";
                        var displayElement = $('<span>').text(displayName)
                            .append($('<a>').attr('href', vesselBaseUrl + vessel.ices_code)
                                .attr('target', '_blank')
                                .attr('rel', 'noopener')
                                .html(' 🚢'));
                        
                        $(vesselElement).hide();
                        let sibs = $(vesselElement).siblings("[data-cvoc-index='" + $(vesselElement).attr('data-cvoc-index') + "']");
                        if (sibs.length == 0) {
                            displayElement.prependTo($(vesselElement).parent());
                        } else {
                            displayElement.insertBefore(sibs.eq(0));
                        }
                        
                        storeValue(vesselPrefix, vessel.ices_code, vessel.name);
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    $(vesselElement).show();
                    let index = $(vesselElement).attr('data-cvoc-index');
                    if (index !== undefined) {
                        $(vesselElement).siblings("[data-cvoc-index='" + index + "']").show().removeClass('hidden').removeAttr('hidden');
                    }
                    
                    if (jqXHR.status != 404) {
                        console.error("R2R vessel lookup error: " + textStatus, errorThrown);
                    }
                }
            });
        }
    });
}

function updateVesselInputs() {
    $(vesselInputSelector).each(function() {
        var vesselInput = this;
        if (!vesselInput.hasAttribute('data-vessel')) {
            let num = Math.floor(Math.random() * 100000000000);
            $(vesselInput).attr('data-vessel', num);
            var vesselBaseUrl = $(vesselInput).attr('data-cvoc-service-url');
            
            if (!vesselBaseUrl) {
                vesselBaseUrl = "https://www.rvdata.us/vessel/";
            }
            
            let parentField = $(vesselInput).attr('data-cvoc-parent');
            var parent = $(vesselInput).closest("[data-cvoc-parentfield='" + parentField + "']");
            let hasParentField = $("[data-cvoc-parentfield='" + parentField + "']").length > 0;
            let managedFields = {};
            
            if (hasParentField) {
                managedFields = JSON.parse($(vesselInput).attr('data-cvoc-managedfields'));
                if (Object.keys(managedFields).length > 0) {
                    // Hide managed fields initially
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselName + "']").hide();
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselIces + "']").hide();
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselDesignation + "']").hide();
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselOperator + "']").hide();
                    
                    $(vesselInput).parent().hide();
                } else {
                    $(vesselInput).hide();
                }
            }
            
            var selectId = "vesselAddSelect_" + num;
            var selectHtml = '<select id="' + selectId + '" class="form-control" style="width: 100%;"></select>';
            $(vesselInput).parent().parent().children('div').eq(0).append(selectHtml);
            
            $("#" + selectId).select2({
                theme: "classic",
                tags: $(vesselInput).attr('data-cvoc-allowfreetext') === 'true',
                delay: 500,
                templateResult: function(item) {
                    if (item.loading) {
                        return item.text;
                    }
                    if (typeof term !== 'undefined' && term) {
                        return markMatch(item.text, term);
                    }
                    return item.text;
                },
                templateSelection: function(item) {
                    return item.text;
                },
                language: {
                    searching: function(params) {
                        return 'Search vessels by name or ICES code...';
                    }
                },
                placeholder: vesselInput.hasAttribute("data-cvoc-placeholder") ?
                    $(vesselInput).attr('data-cvoc-placeholder') : "Select or enter vessel...",
                minimumInputLength: 2,
                allowClear: true,
                ajax: {
                    url: "https://service.rvdata.us/api/vessel/keyword/",
                    data: function(params) {
                        term = params.term;
                        return {
                            keyword: params.term
                        };
                    },
                    headers: {
                        'Accept': 'application/json'
                    },
                    processResults: function(data, page) {
                        if (!data || data.length === 0) {
                            return { results: [] };
                        }
                        
                        return {
                            results: data
                                .sort((a, b) => {
                                    var aHasStored = getValue(vesselPrefix, a.ices_code) && getValue(vesselPrefix, a.ices_code).name != null;
                                    var bHasStored = getValue(vesselPrefix, b.ices_code) && getValue(vesselPrefix, b.ices_code).name != null;
                                    return Number(bHasStored) - Number(aHasStored);
                                })
                                .map(function(vessel) {
                                    return {
                                        text: vessel.name + " (" + vessel.ices_code + ") - " + vessel.operator_name,
                                        id: vessel.ices_code,
                                        vesselData: vessel,
                                        title: 'Vessel: ' + vessel.name + ', Operator: ' + vessel.operator_name
                                    };
                                })
                        };
                    }
                }
            });
            
            // Handle selection
            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                var vesselData = data.vesselData;
                $("input[data-vessel='" + num + "']").val(vesselBaseUrl + data.id);
                
                if (hasParentField && Object.keys(managedFields).length > 0) {
                    var parent = $("input[data-vessel='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                    // Populate managed fields
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselName + "']")
                        .val(vesselData.name).attr('value', vesselData.name);
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselIces + "']")
                        .val(vesselData.ices_code).attr('value', vesselData.ices_code);
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselDesignation + "']")
                        .val(vesselData.designation).attr('value', vesselData.designation);
                    $(parent).find("input[data-cvoc-managed-field='" + managedFields.vesselOperator + "']")
                        .val(vesselData.operator_name).attr('value', vesselData.operator_name);
                }
                
                storeValue(vesselPrefix, data.id, vesselData.name);
            });
            
            // Handle clearing
            $('#' + selectId).on('select2:clear', function(e) {
                $(this).empty().trigger("change");
                $("input[data-vessel='" + num + "']").val('').attr('value', '');
                
                if (hasParentField && Object.keys(managedFields).length > 0) {
                    var parent = $("input[data-vessel='" + num + "']").closest("[data-cvoc-parentfield='" + parentField + "']");
                    for (var key in managedFields) {
                        $(parent).find("input[data-cvoc-managed-field='" + managedFields[key] + "']")
                            .val('').attr('value', '');
                    }
                }
            });
        }
    });
}
