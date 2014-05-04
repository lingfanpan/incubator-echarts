/**
 * echarts可计算特性基类
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, linzhifeng@baidu.com)
 *
 */
define(function (require) {
    var ecData = require('../util/ecData');
    var accMath = require('../util/accMath');
    var zrUtil = require('zrender/tool/util');
    
    function Base(){
        var self = this;
        this.selectedMap = {};
        this.shapeHandler = {
            onclick : function () {
                self.isClick = true;
            },
            
            ondragover : function (param) {
                // 返回触发可计算特性的图形提示
                var calculableShape = param.target;
                calculableShape.highlightStyle = calculableShape.highlightStyle || {};
                
                // 备份特出特性
                var highlightStyle = calculableShape.highlightStyle;
                var brushType = highlightStyle.brushTyep;
                var strokeColor = highlightStyle.strokeColor;
                var lineWidth = highlightStyle.lineWidth;
                
                highlightStyle.brushType = 'stroke';
                highlightStyle.strokeColor = self.ecTheme.calculableColor;
                highlightStyle.lineWidth = calculableShape.type == 'icon' ? 30 : 10;
                
                self.zr.addHoverShape(calculableShape);
                
                setTimeout(function (){
                    // 复位
                    if (calculableShape.highlightStyle) {
                        calculableShape.highlightStyle.brushType = brushType;
                        calculableShape.highlightStyle.strokeColor = strokeColor;
                        calculableShape.highlightStyle.lineWidth = lineWidth;
                    }
                },20);
            },
            
            ondrop : function (param) {
                // 排除一些非数据的拖拽进入
                if (typeof ecData.get(param.dragged, 'data') != 'undefined') {
                    self.isDrop = true;
                }
            },
            
            ondragend : function () {
                self.isDragend = true;
            }
        }
    }
    
    /**
     * 基类方法
     */
    Base.prototype = {
        /**
         * 图形拖拽特性 
         */
        setCalculable : function (shape) {
            shape.dragEnableTime = this.ecTheme.DRAG_ENABLE_TIME;
            shape.ondragover = this.shapeHandler.ondragover;
            shape.ondragend = this.shapeHandler.ondragend;
            shape.ondrop = this.shapeHandler.ondrop;
            return shape;
        },

        /**
         * 数据项被拖拽进来
         */
        ondrop : function (param, status) {
            if (!this.isDrop || !param.target) {
                // 没有在当前实例上发生拖拽行为则直接返回
                return;
            }

            var target = param.target;      // 拖拽安放目标
            var dragged = param.dragged;    // 当前被拖拽的图形对象

            var seriesIndex = ecData.get(target, 'seriesIndex');
            var dataIndex = ecData.get(target, 'dataIndex');

            // 落到数据item上，数据被拖拽到某个数据项上，数据修改
            var data = this.option.series[seriesIndex].data[dataIndex] || '-';
            if (data.value) {
                if (data.value != '-') {
                    this.option.series[seriesIndex].data[dataIndex].value = 
                        accMath.accAdd(
                            this.option.series[seriesIndex].data[dataIndex].value,
                            ecData.get(dragged, 'value')
                        );
                }
                else {
                    this.option.series[seriesIndex].data[dataIndex].value =
                        ecData.get(dragged, 'value');
                }
            }
            else {
                if (data != '-') {
                    this.option.series[seriesIndex].data[dataIndex] = 
                        accMath.accAdd(
                            this.option.series[seriesIndex].data[dataIndex],
                            ecData.get(dragged, 'value')
                        );
                }
                else {
                    this.option.series[seriesIndex].data[dataIndex] =
                        ecData.get(dragged, 'value');
                }
            }

            // 别status = {}赋值啊！！
            status.dragIn = status.dragIn || true;

            // 处理完拖拽事件后复位
            this.isDrop = false;

            return;
        },

        /**
         * 数据项被拖拽出去
         */
        ondragend : function (param, status) {
            if (!this.isDragend || !param.target) {
                // 没有在当前实例上发生拖拽行为则直接返回
                return;
            }
            var target = param.target;      // 被拖拽图形元素

            var seriesIndex = ecData.get(target, 'seriesIndex');
            var dataIndex = ecData.get(target, 'dataIndex');

            // 被拖拽的图形是折线图bar，删除被拖拽走的数据
            this.option.series[seriesIndex].data[dataIndex] = '-';

            // 别status = {}赋值啊！！
            status.dragOut = true;
            status.needRefresh = true;

            // 处理完拖拽事件后复位
            this.isDragend = false;

            return;
        },

        /**
         * 图例选择
         */
        onlegendSelected : function (param, status) {
            var legendSelected = param.selected;
            for (var itemName in this.selectedMap) {
                if (this.selectedMap[itemName] != legendSelected[itemName]) {
                    // 有一项不一致都需要重绘
                    status.needRefresh = true;
                }
                this.selectedMap[itemName] = legendSelected[itemName];
            }
            return;
        },
        
        backupShapeList : function() {
            if (this.shapeList && this.shapeList.length > 0) {
                this.lastShapeList = this.shapeList;
                this.shapeList = [];
            }
            else {
                this.lastShapeList = [];
            }
        },
        
        addShapeList : function() {
            var maxLenth = this.option.animationThreshold / (this.canvasSupported ? 1 : 2);
            var lastShapeList = this.lastShapeList;
            var shapeList = this.shapeList;
            var key;
            var oldMap = {};
            var newMap = {};
            if (lastShapeList && lastShapeList.length > 0 && lastShapeList.length < maxLenth) {
                // 通过已有的shape做动画过渡
                for (var i = 0, l = this.lastShapeList.length; i < l; i++) {
                    key = ecData.get(lastShapeList[i], 'seriesIndex') + '_'
                          + ecData.get(lastShapeList[i], 'dataIndex');
                    if (key.match('undefined') || lastShapeList[i]._mark) {
                        this.zr.delShape(lastShapeList[i].id); // 非关键元素直接删除
                    }
                    else {
                        key += lastShapeList[i].type;
                        oldMap[key] = lastShapeList[i];
                    }
                }
                for (var i = 0, l = this.shapeList.length; i < l; i++) {
                    key = ecData.get(shapeList[i], 'seriesIndex') + '_'
                          + ecData.get(shapeList[i], 'dataIndex');
                    if (key.match('undefined') || shapeList[i]._mark) {
                        this.zr.addShape(shapeList[i]); // 非关键元素直接添加
                    }
                    else {
                        key += shapeList[i].type;
                        newMap[key] = shapeList[i];
                    }
                }
                for (key in oldMap) {
                    if (!newMap[key]) {
                        // 新的没有 删除
                        this.zr.delShape(oldMap[key].id);
                    }
                }
                for (key in newMap) {
                    if (oldMap[key]) {
                        // 新旧都有 动画过渡
                        this.zr.delShape(oldMap[key].id);
                        this._animateMod(oldMap[key], newMap[key]);
                    }
                    else {
                        // 新有旧没有  添加并动画过渡
                        this._animateAdd(newMap[key]);
                    }
                }
                this.animationMark(500);
            }
            else {
                // 直接添加
                for (var i = 0, l = this.shapeList.length; i < l; i++) {
                    this.zr.addShape(shapeList[i]);
                }
            }
        },
        
        _animateMod : function(oldShape, newShape) {
            switch (oldShape.type) {
                case 'broken-line' :
                case 'half-smooth-polygon' :
                    var newPointList = newShape.style.pointList;
                    if (oldShape.style.pointList.length == newPointList.length) {
                        newShape.style.pointList = oldShape.style.pointList;
                    }
                    else if (oldShape.style.pointList.length < newPointList.length) {
                        // 原来短，新的长，补全
                        newShape.style.pointList = oldShape.style.pointList.concat(
                            newPointList.slice(oldShape.style.pointList.length)
                        )
                    }
                    else {
                        // 原来长，新的短，截断
                        newShape.style.pointList = oldShape.style.pointList.slice(
                            0, newPointList.length
                        );
                    }
                    this.zr.addShape(newShape);
                    this.zr.animate(newShape.id, 'style')
                        .when(
                            500,
                            {
                                pointList: newPointList
                            }
                        )
                        .start('ExponentialOut');
                    break;
                case 'rectangle' :
                case 'icon' :
                    var newX = newShape.style.x;
                    var newY = newShape.style.y;
                    var newWidth = newShape.style.width;
                    var newHeight = newShape.style.height;
                    newShape.style.x = oldShape.style.x;
                    newShape.style.y = oldShape.style.y;
                    newShape.style.width = oldShape.style.width;
                    newShape.style.height = oldShape.style.height;
                    this.zr.addShape(newShape);
                    this.zr.animate(newShape.id, 'style')
                        .when(
                            500,
                            {
                                x: newX,
                                y: newY,
                                width: newWidth,
                                height: newHeight
                            }
                        )
                        .start('ExponentialOut');
                    break;
                case 'candle' :
                    /*
                    var newY = newShape.style.y;
                    newShape.style.y = oldShape.style.y;
                    this.zr.addShape(newShape);
                    this.zr.animate(newShape.id, 'style')
                        .when(
                            500,
                            {
                                y: newY
                            }
                        )
                        .start('ExponentialOut');
                    break;
                    */
                default :
                    this.zr.addShape(newShape);
                    break;
            }
        },
        
        _animateAdd : function(newShape) {
            switch (newShape.type) {
                case 'broken-line' :
                case 'half-smooth-polygon' :
                    var newPointList = [];
                    var len = newShape.style.pointList.length;
                    if (newShape._orient != 'vertical') {
                        var y = newShape.style.pointList[0][1];
                        for (var i = 0; i < len; i++) {
                            newPointList[i] = [newShape.style.pointList[i][0], y + i];
                        };
                    }
                    else {
                        var x = newShape.style.pointList[0][0];
                        for (var i = 0; i < len; i++) {
                            newPointList[i] = [x + i, newShape.style.pointList[i][1]];
                        };
                    }
                    if (newShape.type == 'half-smooth-polygon') {
                        newPointList[len - 1] = zrUtil.clone(newShape.style.pointList[len - 1]);
                        newPointList[len - 2] = zrUtil.clone(newShape.style.pointList[len - 2]);
                    }
                    this._animateMod(
                        {
                            type : newShape.type,
                            style : {
                                pointList : newPointList
                            }
                        },
                        newShape
                    );
                    break;
                case 'rectangle' :
                case 'icon' :
                    this._animateMod(
                        {
                            type : newShape.type,
                            style : {
                                x : newShape.style.x,
                                y : newShape._orient == 'vertical'
                                    ? newShape.style.y + newShape.style.height
                                    : newShape.style.y,
                                width: 0,
                                height: 0
                            }
                        },
                        newShape
                    );
                    break;
                default :
                    this._animateMod({}, newShape);
                    break;
            }
        }
    }

    return Base;
});
