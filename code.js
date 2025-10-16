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
const CHART_LEN = 10
const DELIMITER = ":"
const DEFAULT_NODE_NAME = "Новая вершина"
const DEFAULT_NODE_VALUE = 0
const DEFAULT_WEIGHT = 1
var currentAction = Action.BLANK;
var lastNodeId = undefined;
var chartSteps = 0;
var nextId = Math.random();
var isMusicStarted = false;

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
    // |      Финальный штрих           |
    // |                                |
    // |================================|
   const audio = new Audio('music.mp3');
   audio.loop = true;

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

    var group = function(element){
      return element._private.group
    }
    // |================================|
    // |                                |
    // |            График              |
    // |                                |
    // |================================|
    const ctx = document.getElementById('impulseChart').getContext('2d');
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    // min: -1,
                    // max: 1
                }
            }
        }
    });

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
      name: 'circle',
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
    cy.nodes().forEach(function(node) {
      // По умолчанию засунем значение 0 в каждый узел
      var name = node.data("name")
      node.data("name", `${name}${DELIMITER}${0}`)
      // Покрасим в случайные цвета
      node.style("background-color", getRandomColor())
      // И создадим график
      addChart(node);
    })
    cy.edges().forEach(applyEdgeStyle)
    //step();
    
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
    // sliders.forEach( makeSlider );
    // Имеет смысл только с layout fcose, поэтому уберем 

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
    var $structureAnalysisButton = h('button', { }, [t('Структурный анализ')]);
    $structureAnalysisButton.addEventListener('click', structureAnalysis)
    $config.appendChild( $structureAnalysisButton );

    var $stepButton = h('button', { }, [t('Шаг')]);
    $stepButton.addEventListener('click', step)
    $config.appendChild( $stepButton );

    // Пример добавления графа пока что
    var $clearButton = h('button', { }, [t('Очистить импульсы')]);
    $clearButton.addEventListener('click', clearNodeValues)
    $config.appendChild( $clearButton );

    // |================================|
    // |                                |
    // |    Объявления функций          |
    // |                                |
    // |================================|

  function getRandomColor() {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      return `rgb(${r}, ${g}, ${b})`;
  }

  function getNextId() {
    return (nextId++).toString();
  }

    // |================================|
    // |      Парсинг имени узла        |
    // |================================|
    function getNodeName(node) {
      let name_with_value = node.data("name")
      let delimiter_index = name_with_value.lastIndexOf(DELIMITER);
      return name_with_value.substring(0, delimiter_index);
    }

    function getNodeValue(node) {
      let name_with_value = node.data("name")
      let delimiter_index = name_with_value.lastIndexOf(DELIMITER);
      return parseFloat(name_with_value.substring(delimiter_index + 1));
    }

    function setNodeName(node, name) {
      let name_with_value = node.data("name")
      let delimiter_index = name_with_value.lastIndexOf(DELIMITER);
      let value = name_with_value.substring(delimiter_index + 1);
      node.data("name", `${name}${DELIMITER}${value}`)
    }

    function setNodeValue(node, value) {
      let name_with_value = node.data("name")
      let delimiter_index = name_with_value.lastIndexOf(DELIMITER);
      let name = name_with_value.substring(0, delimiter_index);
      node.data("name", `${name}${DELIMITER}${value}`)
    }

    // |================================|
    // |      Создание узла             |
    // |================================|
    function createNode(x, y) {
      let id = getNextId()
      cy.add({
          group: 'nodes',
          data: {
            id: id,
            name: `${DEFAULT_NODE_NAME}${DELIMITER}${DEFAULT_NODE_VALUE}`,
          },
          position: { 
            x: x, 
            y: y, 
          }
      });
      node = cy.getElementById(id)
      node.style("background-color", getRandomColor())
      addChart(node)
    }

    // |================================|
    // |       Разрушение узла          |
    // |================================|
    function destroy(element) {
      if (group(element) == Groups.NODES) { removeChart(element); }
      cy.remove(element);
    }

    // |================================|
    // |      Изменение узла            |
    // |================================|
    function changeNode(node) {
      let name = prompt('Введите новое имя', getNodeName(node));
      let value = parseFloat(prompt('Введите новое название', getNodeValue(node)));
      if (isNaN(value)) {
        alert('Было введено не число')
      } else {
        setNodeName(node, name);
        setNodeValue(node, value);
        updateChart(node);
      }
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
        cy.add({
            group: 'edges',
            data: {
              id: getNextId(),
              source: lastNodeId,
              target: nodeId,
              weight: DEFAULT_WEIGHT,
            },
        });
        clearLastHightlightNode()
      }
      else
      { highlightNextNode(nodeId) }
    }

    // |================================|
    // |       Изменение связи          |
    // |================================|
    function changeEdge(edge) {
      let weight = undefined
      weight = parseFloat(prompt('Введите новое значение', edge.data("weight")));
      if (isNaN(weight)) {
        alert('Было введено не число')
      } else {
        edge.data('weight', weight)
        applyEdgeStyle(edge)
      }
    }

    // Делает ребра с отрицательным весом пунктирнами, 
    // а остальные непрерывными
    function applyEdgeStyle(edge) {
      if (edge.data('weight') < 0) {  
        edge.style({
          'line-style': 'dashed',
          'line-dash-pattern': [6, 3]
        });
      }
      else { edge.removeStyle(); }
    }

    // |================================|
    // |       Поиск циклов             |
    // |================================|
    
    // Обработчик кнопки "Структурный анализ"
    function structureAnalysis() {
      var cyclesList = []
      for (let node of cy.nodes()) {
        cyclesList = cyclesList.concat(depthSearchForCycles([], node, []));
      }
      printAnalysisResult(deleteCopies(cyclesList));
    }

    // Поиском в глубину находит список циклов, содержащих currentNode
    function depthSearchForCycles(cyclesList, currentNode, visetedNodesList) {
      visetedNodesList.push(currentNode)
      for (let edge of currentNode.outgoers().edges()) { 
        nodeId = edge.data("target")
        nextNode = cy.getElementById(nodeId)
        if (nextNode == visetedNodesList[0])
        { cyclesList.push(Array.from(visetedNodesList)) }
        else if (!visetedNodesList.includes(nextNode))
        { cyclesList = depthSearchForCycles(cyclesList, nextNode, Array.from(visetedNodesList)) }
      }
      return cyclesList
    }

    // Убирает повторяющиеся циклы с узлами в другом порядке
    function deleteCopies(cyclesList) {
      cyclesDict = {}
      for (let cycle of cyclesList) {
        cyclesDict[getCycleHash(cycle)] = cycle
      }
      
      var filteredList = [];
      for (var key in cyclesDict) {
        if (cyclesDict.hasOwnProperty(key)) {
            filteredList.push(cyclesDict[key]);
        }
      }

      return filteredList
    }

    // Формирует одинаковые коды для одинаковых циклов 
    // независимо от порядка узлов, нужно для удаления повторов
    function getCycleHash(cycle) {
      var ids = []
      for (let node of cycle) {
        ids.push(node.data("id"))
      }
      ids = ids.sort()
      return ids.join('')
    }

    // Выводит человекочитаемый результат анализа графа
    function printAnalysisResult(cyclesList) {
      var negative_count = 0
      var textResult = ""
      for (let [i, cycle] of cyclesList.entries()) {
        negative_count += is_negative(cycle) ? 1 : 0;
        textResult += `${i + 1}. (${is_negative(cycle) ? '-' : '+'}) `
        firstNode = cycle[0]
        for (let node of cycle) {
          textResult += `${getNodeName(node)}->`
        }
        textResult += `${getNodeName(firstNode)}\n`
      }
      textResult += `\nЧисло узлов: ${cy.nodes().length}\n`
      textResult += `Число ребер: ${cy.edges().length}\n`
      textResult += `Число циклов: ${cyclesList.length}\n`
      textResult += `Число отрицательных циклов: ${negative_count}\n`
      textResult += `Структурная устойчивость: ${negative_count % 2 == 1 ? 'да' : 'нет'}\n`
      alert(textResult);
    }

    // |================================|
    // |    Структурная целостность     |
    // |================================|

    // Цикл отрицательный, если у ребер в нем нечетное число отрицательных весов
    function is_negative(cycle) {
      var product = 1
      for (let [i, from_node] of cycle.entries()) {
        to_node = cycle[(i + 1) % cycle.length]
        product *= get_weight(from_node, to_node)
      }
      return product < 0
    }

    // Находит вес первого попавшегося ребра, идущего из одного узла в другой
    function get_weight(from_node, to_node) {
      for (let edge of from_node.outgoers().edges()) { 
        if (to_node.data("id") == edge.data("target"))
        { return edge.data("weight") }
      }
      return null;
    }

    // |================================|
    // |   Импульсное моделирование     |
    // |================================|
    function step() {
      updateNodeValues();

      chartSteps++;
      chart.data.labels.push(`Время ${chartSteps}`);

      var node;
      for (let [i, dataset] of chart.data.datasets.entries())
      { 
        node = cy.getElementById(dataset.id)
        dataset.data.push(getNodeValue(node));
        console.log(chart.data.labels.length)
        // Смещение данных после максимального числа одновременно отображаемых шагов
        if (chart.data.labels.length > CHART_LEN) {
          chart.data.datasets[i].data = dataset.data.slice(-CHART_LEN);
        }
      }
      // Смещение лейблов после максимального числа одновременно отображаемых шагов
      if (chart.data.labels.length > CHART_LEN) {
        chart.data.labels.shift();
      }

      chart.update();
    }

    function addChart(node) {
      chart.data.datasets.push({
          id: node.data("id"),
          label: getNodeName(node),
          data: [getNodeValue(node)],
          borderColor: node.style("background-color")
      });
      
      chart.update();
    }

    function removeChart(node) {
      const index = chart.data.datasets.findIndex(dataset => dataset.id === node.data("id"));
      if (index !== -1) {
          chart.data.datasets.splice(index, 1);
          chart.update();
      }
    }

    function updateChart(node) {
        const dataset = chart.data.datasets.find(d => d.id === node.data("id"));
        if (dataset) {
            dataset.label = getNodeName(node);
            dataset.data.pop()
            dataset.data.push(getNodeValue(node))
            chart.update();
        }
    }

    function nextNodeValue(node) {
      var newVal = getNodeValue(node)
      for (let edge of node.incomers()) {
        // метод incomers() должен возвращать только ребра 
        // по аналогии с outgoers(), но по факту отдает еще и узлы
        // поэтому фильруем
        if (group(edge) != Groups.EDGES)
        { continue; }
        nodeId = edge.data("source")
        prevNode = cy.getElementById(nodeId)
        newVal += edge.data("weight") * getNodeValue(prevNode)
      }
      return newVal
    }

    function updateNodeValues() {
      nextValues = {}
      for (let node of cy.nodes()) {
        nextValues[node.data("id")] = nextNodeValue(node)
      }

      for (let node of cy.nodes()) {
        setNodeValue(node, nextValues[node.data("id")])
      }
    }

    function clearNodeValues() {
      cy.nodes().forEach(function(node) {
        setNodeValue(node, DEFAULT_NODE_VALUE);
      })
      chart.data.datasets.forEach(dataset => {
          dataset.data = [DEFAULT_NODE_VALUE];
      });
      chartSteps = 0;
      chart.data.labels = [`Время ${chartSteps}`];
      chart.update();
    }

    // |================================|
    // |                                |
    // |    Обработчики событий         |
    // |                                |
    // |================================|
    cy.on('vclick', function(e){
      let target = e.target
      if (currentAction == Action.CREATE) {
        if (group(target) == Groups.NODES) {
          createEdge(target.data("id"))
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
    // |         Модальное окно         |
    // |                                |
    // |================================|

    var modal = document.getElementById("modal");
    var span = document.getElementsByClassName("close")[0];
    var playButton = document.getElementById("playButton");
    
    // Если нажмем на кнопку то включим музыку и закроем модальное окно
    playButton.addEventListener('click', function(e) {
      if (!isMusicStarted) {
        audio.play();
        isMusicStarted = !isMusicStarted
        modal.style.display = "none";
      }
    })

    // Отобразим модальное окно сразу
    modal.style.display = "block";

    // Закроем модальное окно
    span.onclick = function() {
      modal.style.display = "none";
    }
  });