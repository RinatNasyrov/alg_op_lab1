const Colors = {
  BLUE: 'blue',
  RED: 'red',
}
const Groups = {
  NODES: 'nodes',
  EDGES: 'edges',
};
const Action = {
  BLANK: 'blank',
  CREATE: 'create',
  DESTROY: 'destroy',
  CHANGE: 'change',
};
var currentAction = Action.BLANK;
var lastNodeId = undefined;

Promise.all([
  fetch('cy-style.json')
    .then(function(res) {
      return res.json();
    }),
  fetch('data.json')
    .then(function(res) {
      return res.json();
    })
])
  .then(function(dataArray) {
    // |================================|
    // |                                |
    // |    Служебные функции           |
    // |                                |
    // |================================|
    // Создает DOM элемент с атрибутами и дочерними элементами
    var h = function(tag, attrs, children){
      var el = document.createElement(tag);

      Object.keys(attrs).forEach(function(key){
        var val = attrs[key];

        el.setAttribute(key, val);
      });

      children.forEach(function(child){
        el.appendChild(child);
      });

      return el;
    };
    // Создает div с текстом, все
    var t = function(text){
      var el = document.createTextNode(text);

      return el;
    };
    // Функция чтобы найти первый элемент по css-паттерну
    var $ = document.querySelector.bind(document);

    var data = function(element){
      return element._private.data
    }

    var group = function(element){
      return element._private.group
    }

    // |================================|
    // |                                |
    // |          Канвас                |
    // |                                |
    // |================================|
    // Определяем канвас
    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),
      style: dataArray[0],
      elements: dataArray[1],
      layout: { name: 'circle' }
    });

    // Значения слайдеров
    var idealEdgeLengthVal = 500;

    // Параметры отрисовки сцены
    var params = {
      name: 'fcose',
      idealEdgeLength: e => idealEdgeLengthVal,
      animate: true,
      randomize: false
    };

    // Функция отрисовки сцены
    function makeLayout( opts ){
      params.randomize = (opts || {}).randomize || false;

      for( var i in opts ){
        params[i] = opts[i];
      }

      return cy.layout( Object.assign({}, params) );
    }

    // Запуск сцены
    var layout = makeLayout({ animate: true });
    layout.run();
    var $config = $('#config');
    
    // Сворачивание/разворачивание бокового меню
    $('#config-toggle').addEventListener('click', function(){
      $('body').classList.toggle('config-closed');
      cy.resize();
    });

    // |================================|
    // |                                |
    // |     Элементы управления        |
    // |                                |
    // |================================|
    // 
    // |================================|
    // |           Слайдеры             |
    // |================================|
    // 
    // Параметры слайдеров
    var sliders = [
      {
        label: 'Длинна всех ребер',
        update: sliderVal => idealEdgeLengthVal = sliderVal,
        initVal: idealEdgeLengthVal,
        min: 1,
        max: 1000,
        step: 10
      }
    ];
    // Функция добавления объектов слайдеров в параметры
    function makeSlider( opts ){
      var $input = h('input', {
        id: 'slider-'+opts.param,
        type: 'range',
        min: opts.min,
        max: opts.max,
        step: opts.step,
        value: opts.initVal,
        'class': 'slider'
      }, []);

      var $param = h('div', { 'class': 'param' }, []);

      var $label = h('label', { 'class': 'label label-default', for: 'slider-'+opts.param }, [ t(opts.label) ]);

      $param.appendChild( $label );
      $param.appendChild( $input );

      $config.appendChild( $param );

      var update = _.throttle(function(){
        opts.update(parseFloat($input.value));

        layout.stop();
        layout = makeLayout({ animate: true });
        layout.run();
      }, 1000/4, { trailing: true });

      $input.addEventListener('input', update);
      $input.addEventListener('change', update);
    }
    // Непсредственно вызов добавления слайдеров 
    sliders.forEach( makeSlider );

    // |================================|
    // |            Радио               |
    // |================================|
    // Параметры кнопок
    var radio = [
      {
        id: 1,
        name: 'graphAction',
        label: 'Просмотр',
        value: Action.BLANK,
        checked: "",
      },
      {
        id: 2,
        name: 'graphAction',
        label: 'Создание',
        value: Action.CREATE,
      },
      {
        id: 3,
        name: 'graphAction',
        label: 'Разрушение',
        value: Action.DESTROY,
      },
      {
        id: 4,
        name: 'graphAction',
        label: 'Изменение',
        value: Action.CHANGE,
      }
    ];
    // Функция добавления объектов кнопок в параметры
    function makeRadio( opts ){
      var $radioParam = h('div', {
        'class': 'param',
      }, []);
      var $radio = h('input', Object.assign({}, { type: 'radio' }, opts) , []);
      var $label = h('label', { for: opts.id } , [t(opts.label)]);

      $radio.addEventListener('change', function(e) {
        if (this.checked) {
          currentAction = opts.value
          clearLastHightlightNode()
        }
      });

      $radioParam.appendChild( $radio );
      $radioParam.appendChild( $label );
      $config.appendChild( $radioParam );
    }
    // Непсредственно вызов добавления кнопок
    radio.forEach( makeRadio );

    // |================================|
    // |            Кнопки              |
    // |================================|
    var $cyclesButton = h('button', { }, [t('Обнаружить циклы')]);
    $cyclesButton.addEventListener('click', findCycles)
    $config.appendChild( $cyclesButton );

    var $stepButton = h('button', { }, [t('Шаг')]);
    $stepButton.addEventListener('click', addRandomPoint)
    $config.appendChild( $stepButton );

    // Пример добавления графа пока что
    var $clearButton = h('button', { }, [t('Очистить')]);
    $clearButton.addEventListener('click', function() { chart.data.datasets.push({
      id:"11",
      data: [1, 2, 3],
      label: 'test'
    })
    chart.update();
   })
    $config.appendChild( $clearButton );

    // |================================|
    // |                                |
    // |    Объявления функций          |
    // |                                |
    // |================================|
    // |================================|
    // |      Создание узла             |
    // |================================|
    function createNode(x, y) {
      id = Math.random()
      cy.add({
          group: 'nodes',
          data: {
            id: id.toString(),
            idInt: id,
            name: "Новая вершина",
          },
          position: { 
            x: x, 
            y: y, 
          }
      });
    }

    // |================================|
    // |       Создание связи           |
    // |================================|
    function clearLastHightlightNode() {
      if (lastNodeId) { cy.getElementById(lastNodeId).style('background-color', Colors.BLUE); }
      lastNodeId = undefined;
    }

    function highlightNextNode(nodeId){
      clearLastHightlightNode();
      cy.getElementById(nodeId).style('background-color', Colors.RED);
      lastNodeId = nodeId;
    }

    function createEdge(nodeId) {
      if (lastNodeId) {
        id = Math.random()
        cy.add({
            group: 'edges',
            data: {
              id: id.toString(),
              source: lastNodeId,
              target: nodeId,
              weight: 1,
            },
        });
        clearLastHightlightNode()
      }
      else
      { highlightNextNode(nodeId) }
    }

    // |================================|
    // |       Разрушение узла          |
    // |================================|
    function destroy(element) {
      cy.remove(element);
    }

    // |================================|
    // |      Изменение узла            |
    // |================================|
    function changeNode(node) {
      let name = prompt('Введите новое название', data(node).name);
      node.data('name', name)
    }

    // |================================|
    // |       Изменение связи          |
    // |================================|
    function changeEdge(edge) {
      let weight = undefined
      weight = parseFloat(prompt('Введите новое значение', data(edge).weight));
      if (isNaN(weight)) {
        alert('Было введено не число')
      } else {
      edge.data('weight', weight)
      }
    }

    // |================================|
    // |       Поиск циклов             |
    // |================================|
    function findCycles() {
      var cyclesList = []
      for (let node of cy.nodes()) {
        cyclesList = cyclesList.concat(depthSearchForCycles([], node, []));
      }
      printCycles(cyclesList);
    }

    function depthSearchForCycles(cyclesList, currentNode, visetedNodesList) {
      visetedNodesList.push(currentNode)
      for (let edge of currentNode.outgoers().edges()) { 
        nodeId = data(edge).target
        nextNode = cy.getElementById(nodeId)
        if (nextNode == visetedNodesList[0])
        { cyclesList.push(Array.from(visetedNodesList)) }
        else if (!visetedNodesList.includes(nextNode))
        { cyclesList = depthSearchForCycles(cyclesList, nextNode, Array.from(visetedNodesList)) }
      }
      return cyclesList
    }

    function printCycles(cyclesList) {
      var textResult = ""
      for (let [i, cycle] of cyclesList.entries()) {
        textResult += `${i + 1}.`
        firstNode = cycle[0]
        for (let node of cycle) {
          textResult += `${data(node).name}->`
        }
        textResult += `${data(firstNode).name}\n`
      }
      alert(textResult);
    }

    // |================================|
    // |   Импульсное моделирование     |
    // |================================|
    function addDataPoint(value = null) {
      timeCounter++;
      const newValue = value !== null ? value : Math.random() * 100;
      
      chart.data.labels.push(`Время ${timeCounter}`);
      chart.data.datasets[0].data.push(newValue);
      if (chart.data.labels.length > 10) {
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
      }
      chart.update();
    }

    function addRandomPoint() {
      addDataPoint(Math.random() * 100);
    }

    function clearChart() {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      timeCounter = 0;
      chart.update();
    }

    // |================================|
    // |                                |
    // |    Обработчики событий         |
    // |                                |
    // |================================|
    cy.on('click', function(e){
      let target = e.target
      if (currentAction == Action.CREATE) {
        if (group(target) == Groups.NODES) {
          createEdge(data(target).id)
        }
        else if (group(target) === undefined) {
          createNode(e.position.x, e.position.y);
        }
      } else if (currentAction == Action.DESTROY) {
        if (group(target)) { destroy(target); }
      } else if (currentAction == Action.CHANGE) {
        if (group(target) == Groups.NODES) {
          changeNode(target);
        }
        else if (group(target) == Groups.EDGES) {
          changeEdge(target);
        }
      }
    });

    // |================================|
    // |                                |
    // |            График              |
    // |                                |
    // |================================|
    const ctx = document.getElementById('impulseChart').getContext('2d');
    let timeCounter = 0;
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Динамические данные',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
  });