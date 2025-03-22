import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function ImageViewer() {
  // 从路由获取图片路径（需自行实现）
  const location = useLocation();
  const imageUrl = location.state?.imgUrl;

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-2">
        <TransformWrapper>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="flex gap-2 mb-2">
                <button onClick={zoomIn} className="px-3 py-1 bg-blue-500 text-white rounded">
                  Zoom In (+)
                </button>
                <button onClick={zoomOut} className="px-3 py-1 bg-blue-500 text-white rounded">
                  Zoom Out (-)
                </button>
                <button onClick={resetTransform} className="px-3 py-1 bg-red-500 text-white rounded">
                  Reset
                </button>
              </div>
              <TransformComponent>
                <img 
                  src={imageUrl} 
                  alt="MRI Scan" 
                  className="max-w-full h-auto border-2 border-gray-200"
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}