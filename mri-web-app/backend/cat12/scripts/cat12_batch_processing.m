% 后端路径：backend/cat12/scripts/cat12_batch_processing.m
function cat12_batch_processing(input_file, output_dir)
    try
        % 检查输入参数
        if nargin < 2
            error('需要提供输入文件和输出目录');
        end
        
        % 检查文件是否存在
        if ~exist(input_file, 'file')
            error('输入文件不存在: %s', input_file);
        end
        
        % 确保输出目录存在
        if ~exist(output_dir, 'dir')
            mkdir(output_dir);
        end
        
        % 初始化CAT12配置
        cat12_dir = fullfile(getenv('SPM_PATH'), 'toolbox', 'cat12');
        if isempty(cat12_dir)
            error('CAT12路径未配置: 请设置SPM_PATH环境变量');
        end
        
        % 添加必要的路径
        addpath(fullfile(cat12_dir, 'spm12'));
        addpath(fullfile(cat12_dir, 'cat12'));
        
        % 创建批处理作业
        matlabbatch{1}.spm.tools.cat.estwrite.data = {input_file};
        matlabbatch{1}.spm.tools.cat.estwrite.opts.ngaus = [2 2 2 4]; % 组织分类参数
        matlabbatch{1}.spm.tools.cat.estwrite.output.surface = 0; % 关闭表面重建
        
        % 运行处理
        spm('defaults', 'PET');
        spm_jobman('run', matlabbatch);
        
        % 查找结果文件
        [input_dir, ~, ~] = fileparts(input_file);
        result_dir = fullfile(input_dir, 'mri');
        
        % 等待结果目录创建
        max_attempts = 10;
        attempt = 0;
        while ~exist(result_dir, 'dir') && attempt < max_attempts
            pause(1);
            attempt = attempt + 1;
        end
        
        if ~exist(result_dir, 'dir')
            error('处理超时: 结果目录未创建');
        end
        
        % 移动结果文件
        result_files = dir(fullfile(result_dir, '*'));
        for i = 1:length(result_files)
            if ~result_files(i).isdir
                src = fullfile(result_dir, result_files(i).name);
                dst = fullfile(output_dir, result_files(i).name);
                movefile(src, dst);
            end
        end
        
        % 清理临时目录
        rmdir(result_dir);
        
        % 验证输出
        output_files = dir(fullfile(output_dir, '*'));
        if isempty(output_files)
            error('处理失败: 没有生成输出文件');
        end
        
        fprintf('处理完成: %s\n', output_dir);
        
    catch e
        % 记录错误信息
        fprintf('错误: %s\n', e.message);
        fprintf('位置: %s\n', e.stack(1).name);
        fprintf('行号: %d\n', e.stack(1).line);
        rethrow(e);
    end
end