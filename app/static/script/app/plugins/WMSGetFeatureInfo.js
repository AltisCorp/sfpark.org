/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the BSD license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */

/** api: (define)
 *  module = app.plugins
 *  class = WMSGetFeatureInfo
 */

Ext.namespace("app.plugins");

/** api: constructor
 *  .. class:: WMSGetFeatureInfo(config)
 *
 *    This plugins provides an action which, when active, will issue a
 *    GetFeatureInfo request to the WMS of all layers on the map. The output
 *    will be displayed in a popup.
 */   
app.plugins.WMSGetFeatureInfo = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = app_wmsgetfeatureinfo */
    ptype: "app_wmsgetfeatureinfo",

    /** api: config[headingAttribute]
     *  ``String``
     *  Optional feature attribute name with heading information.  Values should
     *  be degrees clockwise relative to north.  If present, this value will be
     *  used to orient the camera in the street view.
     */
    headingAttribute: "ORIENTATION",
    
    /** api: config[outputTarget]
     *  ``String`` Popups created by this tool are added to the map by default.
     */
    outputTarget: "map",

    /** api: config[vendorParams]
     *  ``Object``
     *  Optional object with properties to be serialized as vendor specific
     *  parameters in the requests (e.g. {buffer: 10}).
     */

    /** private: templates
     *  Templates for each feature type and for each mode.
     */
    templates: {
        BLOCKFACE_AVAILABILITY: {
            pricing: new Ext.XTemplate(
                '<h4>{values.attributes.STREET_NAME} ({values.attributes.ADDR_RANGE})<a class="popup-more">&nbsp;</a></h4>',
                '<p>{values.attributes.RATE}</p>',
                '<div class="fullDisplay"><h5>Rates</h5>',
                    '<table><tpl for="values.rates.RS">',
                        '<tr><td>{TIME}</td><td>{RATE}</td></tr>',
                    '</tpl></table>',
                '</div>'
            ),
            availability: new Ext.XTemplate(
                '<h4>{values.attributes.STREET_NAME} ({values.attributes.ADDR_RANGE})<a class="popup-more">&nbsp;</a></h4>',
                '<p>{values.attributes.AVAIL_MSG}</p>',
                '<div class="fullDisplay"><h5>Rates</h5>',
                    '<table><tpl for="values.rates.RS">',
                        '<tr><td>{TIME}</td><td>{RATE}</td></tr>',
                    '</tpl></table>',
                '</div>'
            )
        },
        OSP_AVAILABILITY: {
            pricing: new Ext.XTemplate(
                '<h4>{values.attributes.NAME}<a class="popup-more">&nbsp;</a></h4>',
                '<div class="fullDisplay">{values.attributes.ADDRESS} (<a id="streetview" href="#">Street view</a>)<br>',
                '{values.attributes.PHONE}</div><p>{values.attributes.RATE}</p>',
                '<div class="fullDisplay"><h5>Rates</h5>',
                    '<table><tpl for="values.rates.RS">',
                        '<tr><td>{DESC}</td><td>{RATE}</td></tr>',
                        '<tpl if="RR.length"><tpl for="RR">',
                        '<tr><td colspan="2" class="rate-restriction">{.}</td></tr>',
                        '</tpl></tpl>',
                    '</tpl></table>',
                '</div>',
                '<tpl if="values.hours">',
                    '<div class="fullDisplay"><h5>Hours</h5>',
                        '<table><tpl for="values.hours.OPHRS">',
                            '<tr><td>{DAYS}</td><td>{TIME}</td></tr>',
                        '</tpl><table>',
                    '</div>',
                '</tpl>'
            ),
            availability: new Ext.XTemplate(
                '<h4>{values.attributes.NAME}<a class="popup-more">&nbsp;</a></h4>',
                '<div class="fullDisplay">{values.attributes.ADDRESS} (<a id="streetview" href="#">Street view</a>)<br>',
                '{values.attributes.PHONE}</div><p>{values.attributes.AVAIL_MSG}</p>',
                '<div class="fullDisplay"><h5>Rates</h5>',
                    '<table><tpl for="values.rates.RS">',
                        '<tr><td>{DESC}</td><td>{RATE}</td></tr>',
                        '<tpl if="RR.length"><tpl for="RR">',
                        '<tr><td colspan="2" class="rate-restriction">{.}</td></tr>',
                        '</tpl></tpl>',
                    '</tpl></table>',
                '</div>',
                '<tpl if="values.hours">',
                    '<div class="fullDisplay"><h5>Hours</h5>',
                        '<table><tpl for="values.hours.OPHRS">',
                            '<tr><td>{DAYS}</td><td>{TIME}</td></tr>',
                        '</tpl><table>',
                    '</div>',
                '</tpl>'
            )
        }
    },
    
    handleGetFeatureInfo: function(evt) {
        if (evt.features && evt.features.length > 0) {
            this.feature = evt.features[0];
            var attributes = this.feature.attributes;
            var featureType = this.feature.gml.featureType;
            var tpl = this.templates[featureType][this.target.mode];
            var hours = Ext.decode(this.feature.attributes['OP_HRS']);
            // TODO: have them always provide an array
            if (hours && !(hours.OPHRS instanceof Array)) {
                hours.OPHRS = [hours.OPHRS];
            }
            this.displayPopup(evt, tpl.applyTemplate({
                attributes: attributes,
                rates: Ext.decode(attributes['RATE_SCHED']),
                hours: hours
            }));
        } else {
            if (this.popup && this.popup.expanded === false) {
                this.popup.close();
            }
        }
    },
     
    /** api: method[addActions]
     */
    addActions: function() {
        var actions = app.plugins.WMSGetFeatureInfo.superclass.addActions.call(this, []);

        var updateInfo = function(evt) {
            var map = this.target.mapPanel.map;
            var queryableLayers = this.target.mapPanel.layers.queryBy(function(x){
                return x.get("queryable");
            });
            var layers = [];
            queryableLayers.each(function(x){
                layers.push(x.getLayer());
            });
            layers.reverse();
            if (this.control) {
                this.control.deactivate();  // TODO: remove when http://trac.openlayers.org/ticket/2130 is closed
                this.control.destroy();
            }
            this.control = new OpenLayers.Control.WMSGetFeatureInfo({
                autoActivate: true,
                hover: false,
                layers: layers,
                infoFormat: 'application/vnd.ogc.gml',
                maxFeatures: 1,
                queryVisible: true,
                vendorParams: this.vendorParams,
                eventListeners: {
                    getfeatureinfo: this.handleGetFeatureInfo,
                    beforegetfeatureinfo: this.beforeGetFeatureInfo,
                    scope: this
                }
            });
            map.addControl(this.control);
        };
        
        this.target.mapPanel.layers.on("add", updateInfo, this);
        
        return actions;
    },

    /** private: method[getOrientationForFeature]
     *  :arg feature:
     *
     *  Return the orientation of a feature based on the case insensitive
     *  `headingAttribute` property.
     */
    getOrientationForFeature: function(feature) {
        var orientation = 0;
        if (this.headingAttribute) {
            for (var attr in feature.attributes) {
                if (attr.toUpperCase() === this.headingAttribute.toUpperCase()) {
                    orientation = Number(feature.attributes[attr]);
                    break;
                }
            }
        }
        return orientation;
    },
    
    beforeGetFeatureInfo: function() {
        if (this.popup) {
            this.popup.close();
        }
    },

    showStreetView: function() {
        this.streetview = true;
        var geom = this.feature.geometry.getCentroid();
        this.popup.items.clear();
        this.popup.setSize(800, 275);
        this.popup.add({
            xtype: "gxp_googlestreetviewpanel",
            zoom: 1,
            orientation: this.getOrientationForFeature(this.feature),
            location: new OpenLayers.LonLat(geom.x, geom.y)
        });
        this.popup.panIntoView();
    },

    expandInfo: function() {
        this.popup.expanded = true;
        Ext.select('.fullDisplay').toggleClass('fullDisplay');
        Ext.select('.popup-minimal').removeClass('popup-minimal');
        this.popup.doLayout();
        var el = Ext.get("streetview");
        if (el) {
            el.on("click", function() {
                this.showStreetView();
            }, this);
        }
        // wouldn't it be nice if this worked?
        // this.popup.syncSize();
        // TODO: unhack this
        var frameWidth = this.popup.getFrameWidth() * 2;
        var frameHeight = this.popup.getFrameHeight() * 2;
        var dom = this.popup.items.get(0).el.dom;
        var width = dom.scrollWidth + frameWidth;
        var targetHeight = dom.scrollHeight + frameHeight;
        var height = Math.min(targetHeight, 275);
        if (targetHeight > height) {
            // get rid of horizontal scrollbar
            width += 12;
        }
        this.popup.setSize(width, height);
        this.popup.panIntoView();
    },

    /** private: method[displayPopup]
     * :arg evt: the event object from a 
     *     :class:`OpenLayers.Control.GetFeatureInfo` control
     * :arg text: ``String`` Body text.
     */
    displayPopup: function(evt, text) {
        if (this.popup) {
            this.popup.close();
        }
        this.streetview = false;
        this.popup = this.addOutput({
            xtype: "gx_popup",
            cls: "popup-minimal",
            expanded: false,
            layout: "fit",
            resizable: false,
            items: [{
                xtype: "box",
                autoScroll: true,
                cls: "popup-content",
                html: text
            }],
            closable: true,
            unpinnable: false,
            location: evt.xy,
            map: this.target.mapPanel,
            listeners: {
                close: function(popup) {
                    if (this.streetview) {
                        this.target.mapPanel.map.setCenter(popup.location);
                    }
                },
                scope: this
            }
        });
        Ext.select("a.popup-more").on({
            click: function(event, el) {
                Ext.get(el).hide();
                this.expandInfo();
            },
            scope: this
        });
    }
    
});

Ext.preg(app.plugins.WMSGetFeatureInfo.prototype.ptype, app.plugins.WMSGetFeatureInfo);
