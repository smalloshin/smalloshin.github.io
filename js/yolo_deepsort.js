var video = document.getElementById('yolo-deepsort');
var canvasElem = document.createElement('canvas');
(async () => {
  var previous_frame = 0;
  var existing_objects = {
    'motorbike': [],
    'smallcar': [],
    'bigcar': [],
  };
  let am0930track_data, raintrack_data, track_data;
  let am0930response = await fetch("data/yolo_deepsort/AM0930.csv");
  const am0930csvText = await am0930response.text();
  const am0930rows = am0930csvText.split("\n").map((row) => row.split(","));
  am0930rows.shift();
  am0930track_data = groupByFrame(am0930rows);
  
  let rainresponse = await fetch("data/yolo_deepsort/rain.csv");
  const raincsvText = await rainresponse.text();
  const rainrows = raincsvText.split("\n").map((row) => row.split(","));
  rainrows.shift();
  raintrack_data = groupByFrame(rainrows);
  track_data = am0930track_data;
  var fps_factor = 30;
  canvasElem.width = video.width;
  canvasElem.height = video.height;
  var yolo_deepsort_canvas = new fabric.Canvas(canvasElem, {});
  $(".yd-select > select").on('change', function(){
    $("#yd-btn").text("Show");
    fps_factor = 30;
    var selected = $(this).children("option:selected").val();
    yolo_deepsort_canvas.clear();
    $("#bigcar").text(0);
    $("#smallcar").text(0);
    $("#motorbike").text(0);
    previous_frame = 0;
    existing_objects = {
      'motorbike': [],
      'smallcar': [],
      'bigcar': [],
    };
    if (selected == 'AM0930'){
      fps_factor = 30;
      video.src = 'data/yolo_deepsort/AM0930.mp4';
      track_data = am0930track_data;
      video.load();
    }
    else if (selected == 'rain'){
      fps_factor = 31.94;
      video.src = 'data/yolo_deepsort/rain.mp4';
      track_data = raintrack_data;
      video.load();
    }
  });

  function groupByFrame(rows) {
    return rows.reduce((acc, row) => {
      const frame = row[0];
      if (!frame) return acc; // Skip rows with no frame number
      acc[frame] = acc[frame] || [];
      acc[frame].push({
        object_id: parseFloat(row[1]),
        object_type: row[2],
        bbox_left_up_x: parseFloat(row[3]),
        bbox_left_up_y: parseFloat(row[4]),
        bbox_x_length: parseFloat(row[5]),
        bbox_y_length: parseFloat(row[6]),
      });
      return acc;
    }, {});
  }

  // set canvas size
  // append canvas element to the DOM
  $(".video-container").append(canvasElem);

  var rect = new fabric.Rect({
      left: 0,
      top: 0,
      fill: 'rgba(0,0,0,0.5)',
      width: 0,
      height: 0,
      selectable: false,
      evented: false,
      hasControls: false,
      hoverCursor: 'default',
      moveCursor: 'default',
      defaultCursor: 'default',
  });


  
  video.addEventListener('play', function() {
    var frameNumber = 0;
    var intervalID = window.setInterval(function() {
      if (video.paused || video.ended) {
          window.clearInterval(intervalID);
          return;
      }
      frameNumber = Math.floor(video.currentTime * fps_factor);
      if (previous_frame == frameNumber){
        return;
      }
      else{
        
        var objects = track_data[frameNumber+3] || [];
        if (!track_data[frameNumber+3]){
          return;
        }
        yolo_deepsort_canvas.clear(); // Clear the canvas before drawing new objects
      
        // Draw a rectangle for each object in the current frame
        objects.forEach(function(obj) {
          if (obj.object_type == 'smallcar'){
            if (existing_objects['smallcar'].includes(obj.object_id)){
            }
            else{
              existing_objects['smallcar'].push(obj.object_id);
            }
            var color = 'rgba(255,255,0,0.2)'
            var stroke_color = 'yellow'
          }
          else if (obj.object_type == 'motorbike'){
            if (existing_objects['motorbike'].includes(obj.object_id)){
            }
            else{
              existing_objects['motorbike'].push(obj.object_id);
            }
            var color = 'rgba(255,0,0,0.2)'
            var stroke_color = 'red'
          }
          else if (obj.object_type == 'bigcar'){
            if (existing_objects['bigcar'].includes(obj.object_id)){
            }
            else{
              existing_objects['bigcar'].push(obj.object_id);
            }
            var color = 'rgba(0,255,0,0.2)'
            var stroke_color = 'green'
          }
          else if (obj.object_type == 'person'){
            var color = 'rgba(0,125,255,0.2)'
            var stroke_color = 'blue'
          }

          var rect = new fabric.Rect({
            left: obj.bbox_left_up_x/2,
            top: obj.bbox_left_up_y/2,
            width: obj.bbox_x_length/2,
            height: obj.bbox_y_length/2,
            fill: color,
            stroke: stroke_color,
            selectable: false,
            evented: false,
            hasControls: false,
            hoverCursor: 'default',
            moveCursor: 'default',
            defaultCursor: 'default',
          });
          var label = new fabric.Text(obj.object_id + '-' + obj.object_type, {
            left: obj.bbox_left_up_x/2,
            top: obj.bbox_left_up_y/2 - 10,
            fontSize: 10,
            fill: stroke_color,
            selectable: false,
            evented: false,
            hasControls: false,
            hoverCursor: 'default',
            moveCursor: 'default',
            defaultCursor: 'default',
            backgroundColor: 'rgba(0,0,0,0.5)',
          });
          yolo_deepsort_canvas.add(label);
          yolo_deepsort_canvas.add(rect);
        });
        $("#bigcar").text(existing_objects['bigcar'].length);
        $("#smallcar").text(existing_objects['smallcar'].length);
        $("#motorbike").text(existing_objects['motorbike'].length);
        yolo_deepsort_canvas.renderAll();
      }
      
    }, fps_factor);
    previous_frame = frameNumber;
  });
  $("#yd-btn").click(function(){
    if (video.src){
      if($("#yd-btn").text() === "Show"){
        video.play();
        $("#yd-btn").text("Pause");
      }
      else if($("#yd-btn").text() === 'Pause'){
        video.pause();
        $("#yd-btn").text('Show');
      }
    }
    
    
  });
})();